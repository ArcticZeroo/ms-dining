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
import { trackOrderEvent } from '../../../shared/ordering/order-telemetry.js';
import { hashOrderItems } from '../util/order.js';

export const ORDER_SESSION_TTL_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const ORPHAN_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const PREWARM_TTL_MS = 5 * 60 * 1000;

const ACTIVE_ORDER_SESSIONS = new LockedExpiringMap<string, IOrderSession>(ORDER_SESSION_TTL_MS);
const PREWARMED_SESSIONS = new LockedExpiringMap<string, IOrderSession>(PREWARM_TTL_MS);

const orderLog = getNamespaceLogger('OrderSessions');

const prewarmKey = (userId: string, cafeId: string) => `${userId}:${cafeId}`;

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

            // Try to promote a prewarmed session (already through addToCart)
            const prewarmed = await promotePrewarmedSession(userId, cafeId, items);
            if (prewarmed) {
                orderLog.info(`Using prewarmed session for ${pendingOrderId} — only iframe step needed`);
                await prewarmed.prepareForIframe(iframeCssUrl);
                return prewarmed;
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

// ── Prewarm ──────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: creates a BoD session through the addToCart stage
 * so that a subsequent getPaymentSession can skip the expensive steps.
 * If a prewarm for the same user+cafe with the same items hash already
 * exists, this is a no-op.
 */
export const prewarmSession = async (userId: string, cafeId: string, items: IOrderItem[]): Promise<void> => {
    if (isFakeOrderingEnabled) {
        return;
    }

    const key = prewarmKey(userId, cafeId);
    const newHash = hashOrderItems(items);

    // If an existing prewarm has the same hash, no work needed
    const existingSession = await PREWARMED_SESSIONS.get(key);
    if (existingSession && existingSession.itemsHash === newHash) {
        orderLog.info(`Prewarm cache hit for ${key} — items unchanged`);
        return;
    }

    // Discard stale prewarm if any, then build a fresh one
    if (existingSession) {
        orderLog.info(`Prewarm stale for ${key} — rebuilding`);
        await PREWARMED_SESSIONS.delete(key);
    }

    orderLog.info(`Prewarming session for ${key} (${items.length} item(s))`);
    const session = await createOrderSession(cafeId, items);

    await PREWARMED_SESSIONS.update(key, () => session);
    orderLog.info(`Prewarm ready for ${key}`);
};

/**
 * Try to promote a prewarmed session for use in payment.
 * Returns the session if the items hash matches, otherwise undefined.
 * The session is removed from the prewarm map on promotion.
 */
export const promotePrewarmedSession = async (userId: string, cafeId: string, items: IOrderItem[]): Promise<IOrderSession | undefined> => {
    const key = prewarmKey(userId, cafeId);
    const targetHash = hashOrderItems(items);

    let promoted: IOrderSession | undefined;
    await PREWARMED_SESSIONS.update(key, (session) => {
        if (session && session.itemsHash === targetHash && session.createdDateString === getTodayDateString()) {
            promoted = session;
            orderLog.info(`Promoting prewarmed session for ${key}`);
            return undefined; // remove from prewarm map
        }

        if (session) {
            orderLog.info(`Prewarm hash mismatch for ${key} — discarding`);
        }
        return undefined; // discard stale
    });

    return promoted;
};

/**
 * Extend TTL for all prewarmed sessions belonging to a user.
 * Called from the keepalive endpoint while the user is on the checkout page.
 */
export const keepalivePrewarm = async (userId: string): Promise<number> => {
    const prefix = `${userId}:`;
    let touchedCount = 0;

    for (const [key] of PREWARMED_SESSIONS.entries()) {
        if (key.startsWith(prefix)) {
            // update() with identity callback refreshes TTL
            await PREWARMED_SESSIONS.update(key, (session) => session);
            touchedCount++;
        }
    }

    return touchedCount;
};