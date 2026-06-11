import { ICompleteOrderResultDTO, IOrderItem } from '@msdining/common/models/order';
import { getTodayDateString } from '@msdining/common/util/date-util';
import { CAFES_BY_ID } from '../../../shared/constants/cafes.js';
import { isFakeOrderingEnabled } from '../../../shared/constants/env.js';
import { LockedExpiringMap } from '../../../shared/lock/map.js';
import { trackOrderEvent } from '../../../shared/ordering/order-telemetry.js';
import { getNamespaceLogger } from '../../../shared/util/log.js';
import { SERVICE_ERROR_CODES, ServiceError } from '../../rpc/index.js';
import { FakeCafeOrderSession } from '../cafe/session/fake-order-session.js';
import type { IOrderSession } from '../cafe/session/order-session.js';
import { CafeOrderSession } from '../cafe/session/order.js';
import { CartStorageClient } from '../storage/clients/cart/cart.js';
import { OrderStorageClient } from '../storage/clients/order/order.js';
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

export const createOrderSession = async (cafeId: string, items: IOrderItem[]): Promise<IOrderSession> => {
    const cafe = getCafeOrThrow(cafeId);

    if (isFakeOrderingEnabled) {
        const session = new FakeCafeOrderSession(cafe, items);
        await session.populateCart();
        return session;
    }

    const session = await CafeOrderSession.createAsync(cafe, items);
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
}

export const getPaymentSession = async ({ userId, cafeId, items, iframeCssUrl }: IGetPaymentSessionParams): Promise<[string /*pendingOrderId*/, IOrderSession]> => {
    const pendingOrderId = await OrderStorageClient.getOrCreatePendingOrder(
        userId,
        cafeId,
        items,
    );

    const session = await ACTIVE_ORDER_SESSIONS.update(pendingOrderId, async (session) => {
        if (!session || !session.isUsableForPaymentWithItems(items)) {
            session = await promotePrewarmedSession(userId, cafeId, items) ?? await createOrderSession(cafeId, items);
        }

        await session.prepareForIframe(iframeCssUrl);
        return session;
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

        // I hate doing this (setting an outer variable in the locked map closure), but it is probably necessary here
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
 * Creates a BoD session through the addToCart stage so that a subsequent
 * getPaymentSession can skip the expensive steps.
 * If a prewarm for the same user+cafe with the same items hash already
 * exists, returns it without rebuilding.
 * Returns the (possibly cached) prewarmed session.
 */
export const getOrCreatePrewarmedSession = async (userId: string, cafeId: string, items: IOrderItem[]): Promise<IOrderSession> => {
    const key = prewarmKey(userId, cafeId);
    const newHash = hashOrderItems(items);

    return PREWARMED_SESSIONS.update(key, async (session) => {
        if (session && session.itemsHash === newHash) {
            orderLog.info(`Prewarm cache hit for ${key} — items unchanged`);
            return session;
        }

        return createOrderSession(cafeId, items);
    });
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
        if (session && session.isUsableForPaymentWithItems(targetHash)) {
            promoted = session;
            orderLog.info(`Promoting prewarmed session for ${key}`);
        }

        // Always remove from cache:
        // - If the session was promoted, we no longer need to keep this in prewarmed
        // - If the session wasn't promoted, it's because it was stale
        return undefined;
    });

    return promoted;
};

/**
 * Extend TTL for all prewarmed sessions belonging to a user.
 * Called from the keepalive endpoint while the user is on the checkout page.
 */
export const keepalivePrewarm = async (userId: string): Promise<number> => {
    const cart = await CartStorageClient.getCart(userId);
    const itemsByCafe = new Map(cart.cafes.map(cafe => [cafe.cafeId, cafe.items] as const));

    const prefix = `${userId}:`;
    let touchedCount = 0;

    // don't care what the promise type is
    const updatePromises: Array<Promise<unknown>> = [];

    for (const [key] of PREWARMED_SESSIONS.entries()) {
        if (key.startsWith(prefix)) {
            updatePromises.push(PREWARMED_SESSIONS.update(key, (session) => {
                if (!session) {
                    // Missing or wrong date; remove
                    return undefined;
                }

                const itemsForCafe = itemsByCafe.get(session.client.cafe.id);
                if (!itemsForCafe) {
                    // User's cart doesn't have items in this cafe; remove prewarm since it is no longer relevant
                    return undefined;
                }

                if (!session.isUsableForPaymentWithItems(itemsForCafe)) {
                    // User's cart is different from the prewarmed session; remove since it is no longer relevant
                    return undefined;
                }

                touchedCount++;
                return session;
            }));
        }
    }

    await Promise.all(updatePromises);

    return touchedCount;
};