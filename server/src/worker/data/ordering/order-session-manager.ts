import type { IOrderSession } from '../cafe/session/order-session.js';
import { FakeCafeOrderSession } from '../cafe/session/fake-order-session.js';
import { CafeOrderSession } from '../cafe/session/order.js';
import type { ISynthesisFlags } from '../../../shared/services/order.js';
import { CAFES_BY_ID } from '../../../shared/constants/cafes.js';
import { SERVICE_ERROR_CODES, ServiceError } from '../../rpc/index.js';
import { isFakeOrderingEnabled } from '../../../shared/constants/env.js';
import { OrderStorageClient } from '../storage/clients/order/order.js';
import { getTodayDateString } from '@msdining/common/util/date-util';
import { LockedExpiringMap } from '../../../shared/lock/map.js';
import { ICompleteOrderResultDTO, IOrderItem } from '@msdining/common/models/order';
import { getNamespaceLogger } from '../../../shared/util/log.js';
import { trackOrderEvent } from './order-telemetry.js';

export const ORDER_SESSION_TTL_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const ORPHAN_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

const ACTIVE_ORDER_SESSIONS = new LockedExpiringMap<string, IOrderSession>(ORDER_SESSION_TTL_MS);

const orderLog = getNamespaceLogger('OrderSessions');

const refreshSessionToken = (pendingOrderId: string, liveSession: IOrderSession) => {
    const todayDateString = getTodayDateString();
    if (liveSession.createdDateString !== todayDateString) {
        trackOrderEvent('session.evicted', {
            pendingOrderId,
            reason:      'staleDate',
            createdDate: liveSession.createdDateString,
            today:       todayDateString,
        });
        orderLog.info(`Evicting stale session ${pendingOrderId} (created ${liveSession.createdDateString}, today is ${todayDateString})`);
        return ACTIVE_ORDER_SESSIONS.delete(pendingOrderId);
    }

    return ACTIVE_ORDER_SESSIONS.peek(pendingOrderId, async (liveSession) => {
        if (!liveSession) {
            return;
        }

        await liveSession.client.refreshLogin();
    });
}

setInterval(() => {
    const refreshPromises = Array.from(ACTIVE_ORDER_SESSIONS.entries())
        .map(([pendingOrderId, liveSession]) => refreshSessionToken(pendingOrderId, liveSession));
    Promise.all(refreshPromises).catch(err => orderLog.error('Token refresh sweep failed:', err));
}, TOKEN_REFRESH_INTERVAL_MS);

setInterval(() => {
    const liveSessionIds = Array.from(ACTIVE_ORDER_SESSIONS.keys());

    OrderStorageClient.removeOrphanedPendingOrders(liveSessionIds)
        .then(removedCount => {
            if (removedCount > 0) {
                trackOrderEvent('orphans.cleanup', {
                    removedCount: String(removedCount),
                    liveCount:    String(liveSessionIds.length),
                });
                orderLog.info(`Cleaned up ${removedCount} orphaned pending order(s)`);
            }
        })
        .catch(err => orderLog.error('Failed to clean up orphaned pending orders:', err));
}, ORPHAN_CLEANUP_INTERVAL_MS);

const getCafeOrThrow = (cafeId: string) => {
    const cafe = CAFES_BY_ID.get(cafeId);
    if (!cafe) {
        throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cafe ${cafeId} not found`);
    }
    return cafe;
};

export const createOrderSession = async (cafeId: string, items: IOrderItem[], synthesisFlags?: ISynthesisFlags): Promise<IOrderSession> => {
    const cafe = getCafeOrThrow(cafeId);

    if (isFakeOrderingEnabled) {
        const session = new FakeCafeOrderSession(cafe, items);
        await session.populateCart();
        return session;
    }

    const session = await CafeOrderSession.createAsync(cafe, items, synthesisFlags);
    await session.populateCart();

    if (!session.orderId || !session.orderNumber) {
        throw new Error('Order ID or order number not set after cart population');
    }

    return session;
};

interface IGetPaymentSessionParams {
	userId: string;
	cafeId: string;
	items: IOrderItem[];
	iframeCssUrl: string;
	synthesisFlags?: ISynthesisFlags;
}

export const getPaymentSession = async ({ userId, cafeId, items, iframeCssUrl, synthesisFlags }: IGetPaymentSessionParams): Promise<[string /*pendingOrderId*/, IOrderSession]> => {
    const pendingOrderId = await OrderStorageClient.getOrCreatePendingOrder(
        userId,
        cafeId,
        items,
    );

    const session = await ACTIVE_ORDER_SESSIONS.update(pendingOrderId, async (session) => {
        const isReusable = session && session.isReadyForPayment;

        if (!isReusable) {
            if (session) {
                orderLog.info(`Discarding stale session for ${pendingOrderId} (stage=${session.lastCompletedStage}, created=${session.createdDateString})`);
            }
            session = await createOrderSession(cafeId, items, synthesisFlags);
            await session.prepareForIframe(iframeCssUrl);
        }

        return session!;
    });

    if (!session) {
        throw new ServiceError(
            SERVICE_ERROR_CODES.INTERNAL,
            'Failed to create order session',
        );
    }

    return [pendingOrderId, session];
}

export const completeOrder = async (pendingOrderId: string, doCompletion: (session: IOrderSession) => Promise<ICompleteOrderResultDTO>): Promise<ICompleteOrderResultDTO> => {
    let result: ICompleteOrderResultDTO | undefined;
    await ACTIVE_ORDER_SESSIONS.update(pendingOrderId, async (session) => {
        if (!session) {
            throw new ServiceError(
                SERVICE_ERROR_CODES.BAD_REQUEST,
                'Session expired. Please prepare payment again.',
            );
        }

        // I hate doing this, but it is probably necessary here
        result = await doCompletion(session);

        // Remove the session since we are done with it; order completed if we got here
        return undefined;
    });

    if (!result) {
        throw new ServiceError(
            SERVICE_ERROR_CODES.INTERNAL,
            'Could not complete order.'
        );
    }

    return result;
}