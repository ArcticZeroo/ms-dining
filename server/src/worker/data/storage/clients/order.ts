import { usePrismaClient, usePrismaTransaction, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CafeOrderSession } from '../../cafe/session/order.js';
import { WaitTimeSession } from '../../cafe/session/wait-time.js';
import { CartStorageClient } from './cart.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import type { ICartItem } from '@msdining/common/models/cart';
import { ACTIVE_ORDER_CAFE_PART_STATUSES, SubmitOrderStage } from '@msdining/common/models/cart';
import type { PrismaTransactionClient } from '../../../../shared/models/prisma.js';
import type {
    ICheckoutResult,
    ICheckoutCafeResult,
    IPreparePaymentResult,
    ICompleteOrderResult,
} from '@msdining/common/models/order';
import type { ISerializedModifier } from '@msdining/common/models/cart';
import { phone } from 'phone';

const orderLog = getNamespaceLogger('Order');

// ─── In-memory session management ───────────────────────────────────

interface ILiveSession {
    session: CafeOrderSession;
    refreshInterval: ReturnType<typeof setInterval>;
    ttlTimeout: ReturnType<typeof setTimeout>;
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

// Keyed by `${orderSessionId}:${cafeId}`
const liveSessions = new Map<string, ILiveSession>();

const sessionKey = ({ orderSessionId, cafeId }: { orderSessionId: string; cafeId: string }) =>
    `${orderSessionId}:${cafeId}`;

const cleanupLiveSession = (key: string) => {
    const live = liveSessions.get(key);
    if (live) {
        clearInterval(live.refreshInterval);
        clearTimeout(live.ttlTimeout);
        liveSessions.delete(key);
    }
};

const storeLiveSession = (key: string, session: CafeOrderSession) => {
    cleanupLiveSession(key);

    const refreshInterval = setInterval(() => {
        session.client.refreshLogin().catch(err => {
            orderLog.error(`Failed to refresh token for session ${key}:`, err);
        });
    }, TOKEN_REFRESH_INTERVAL_MS);

    const ttlTimeout = setTimeout(() => cleanupLiveSession(key), SESSION_TTL_MS);

    liveSessions.set(key, { session, refreshInterval, ttlTimeout });
};

const resetSessionTTL = (key: string) => {
    const live = liveSessions.get(key);
    if (live) {
        clearTimeout(live.ttlTimeout);
        live.ttlTimeout = setTimeout(() => cleanupLiveSession(key), SESSION_TTL_MS);
    }
};

// ─── Helpers ─────────────────────────────────────────────────────────

const deserializeModifiers = (modifiers: ISerializedModifier[]): Map<string, Set<string>> =>
    new Map(modifiers.map(mod => [mod.modifierId, new Set(mod.choiceIds)]));

const ensureOrderBelongsToUser = async (tx: PrismaTransactionClient, orderSessionId: string, userId: string) => {
    const order = await tx.orderSession.findUnique({
        where: { id: orderSessionId },
        select: { userId: true },
    });
    if (!order) {
        throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'Order not found');
    }
    if (order.userId !== userId) {
        throw new ServiceError(SERVICE_ERROR_CODES.FORBIDDEN, 'Order does not belong to this user');
    }
};

const getCafePart = async (tx: PrismaTransactionClient, orderSessionId: string, cafeId: string) => {
    const part = await tx.orderCafePart.findFirst({
        where: { orderSessionId, cafeId },
    });
    if (!part) {
        throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `No order part for cafe ${cafeId}`);
    }
    return part;
};

// ─── Storage Client ──────────────────────────────────────────────────

export abstract class OrderStorageClient {
    /**
     * Create an order from the user's current cart.
     * For each cafe in the cart, creates a CafeOrderSession and populates
     * the BoD cart. Persists the order and cafe parts to the DB.
     */
    static async checkout(userId: string): Promise<ICheckoutResult> {
        // Get the user's cart items (available only)
        const cartResponse = await CartStorageClient.getCart(userId);
        const availableItems = cartResponse.items.filter(item => item.isAvailable);

        if (availableItems.length === 0) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Cart is empty or has no available items');
        }

        // Group cart items by cafeId
        const itemsByCafe = new Map<string, typeof availableItems>();
        for (const item of availableItems) {
            const cafeId = item.menuItem.cafeId;
            const existing = itemsByCafe.get(cafeId) ?? [];
            existing.push(item);
            itemsByCafe.set(cafeId, existing);
        }

        // Create the OrderSession in DB
        const orderSession = await usePrismaWrite(prisma => prisma.orderSession.create({
            data: { userId },
        }));

        const cafeResults: ICheckoutCafeResult[] = [];

        // For each cafe, build the BoD cart
        for (const [cafeId, items] of itemsByCafe) {
            const cafe = CAFES_BY_ID.get(cafeId);
            if (!cafe) {
                orderLog.error(`Cafe ${cafeId} not found in config during checkout`);
                continue;
            }

            // Convert cart items to ICartItem format for CafeOrderSession
            const cartItems: ICartItem[] = items.map(item => ({
                itemId:              item.menuItemId,
                quantity:            item.quantity,
                choicesByModifierId: deserializeModifiers(item.modifiers),
                specialInstructions: item.specialInstructions ?? undefined,
            }));

            try {
                const session = await CafeOrderSession.createAsync(cafe, cartItems);
                await session.populateCart();

                const orderId = session.orderId;
                const orderNumber = session.orderNumber;

                if (!orderId || !orderNumber) {
                    throw new Error('Order ID or order number not set after cart population');
                }

                // Get wait time
                const waitTime = await WaitTimeSession.retrieveWaitTimeWithCartItems(
                    session.client,
                    [...session.rawCartItemsForWaitTime],
                );

                // Persist cafe part to DB
                const itemsSnapshot = items.map(item => ({
                    menuItemId: item.menuItemId,
                    name:       item.menuItem.name,
                    quantity:   item.quantity,
                    price:      item.menuItem.price,
                    modifiers:  item.modifiers,
                }));

                await usePrismaWrite(prisma => prisma.orderCafePart.create({
                    data: {
                        orderSessionId:         orderSession.id,
                        cafeId,
                        buyOnDemandOrderId:     orderId,
                        buyOnDemandOrderNumber: orderNumber,
                        status:                 'pending',
                        subtotal:               session.orderTotalWithoutTax,
                        tax:                    session.orderTotalTax,
                        total:                  session.orderTotalWithTax,
                        waitTimeMin:            waitTime.minTime,
                        waitTimeMax:            waitTime.maxTime,
                        itemsJson:              JSON.stringify(itemsSnapshot),
                    },
                }));

                // Store live session for payment flow
                const key = sessionKey({ orderSessionId: orderSession.id, cafeId });
                storeLiveSession(key, session);

                cafeResults.push({
                    cafeId,
                    buyOnDemandOrderId:     orderId,
                    buyOnDemandOrderNumber: orderNumber,
                    subtotal:               session.orderTotalWithoutTax,
                    tax:                    session.orderTotalTax,
                    total:                  session.orderTotalWithTax,
                    waitTimeMin:            waitTime.minTime,
                    waitTimeMax:            waitTime.maxTime,
                });

                orderLog.info(`{${cafe.name}} Checkout complete — orderId: ${orderId}, orderNumber: ${orderNumber}`);
            } catch (err) {
                orderLog.error(`{${cafe.name}} Checkout failed:`, err);

                // Record the failure in DB
                await usePrismaWrite(prisma => prisma.orderCafePart.create({
                    data: {
                        orderSessionId: orderSession.id,
                        cafeId,
                        status:    'failed',
                        lastError: err instanceof Error ? err.message : String(err),
                        lastStage: 'checkout',
                    },
                }));
            }
        }

        if (cafeResults.length === 0) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'All cafe checkouts failed');
        }

        // Clear the cart after successful checkout (bypass the active-order
        // check since we just created the order from this cart)
        await usePrismaWrite(prisma => prisma.cartItem.deleteMany({
            where: { cartUserId: userId },
        }));

        return {
            orderSessionId: orderSession.id,
            cafeResults,
        };
    }

    static async setPaymentIdentity(
        userId: string,
        orderSessionId: string,
        alias: string,
        phoneNumberWithCountryCode: string,
    ): Promise<void> {
        await usePrismaTransaction(async tx => {
            await ensureOrderBelongsToUser(tx, orderSessionId, userId);

            // Reject if any cafe part has already progressed past pending
            const advancedParts = await tx.orderCafePart.findFirst({
                where: {
                    orderSessionId,
                    status: { not: 'pending' },
                },
                select: { id: true },
            });
            if (advancedParts) {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.CONFLICT,
                    'Cannot change payment identity after payment has been prepared. Abandon the order and try again.',
                );
            }

            await tx.orderSession.update({
                where: { id: orderSessionId },
                data:  { alias, phoneNumberWithCountryCode },
            });
        });
    }

    static async preparePayment(
        userId: string,
        orderSessionId: string,
        cafeId: string,
        iframeCssUrl: string,
    ): Promise<IPreparePaymentResult> {
        // Verify ownership
        await usePrismaTransaction(async tx => {
            await ensureOrderBelongsToUser(tx, orderSessionId, userId);
            const part = await getCafePart(tx, orderSessionId, cafeId);
            if (part.status !== 'pending' && part.status !== 'payment_pending') {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.BAD_REQUEST,
                    `Cannot prepare payment for cafe ${cafeId} in status '${part.status}'`,
                );
            }
        });

        const key = sessionKey({ orderSessionId, cafeId });
        let live = liveSessions.get(key);

        // Rebuild session if expired
        if (!live) {
            orderLog.info(`Session expired for ${key}, rebuilding...`);
            const part = await usePrismaClient(prisma => prisma.orderCafePart.findFirst({
                where: { orderSessionId, cafeId },
            }));

            if (!part || !part.buyOnDemandOrderId) {
                throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Cannot rebuild session — missing BoD order data');
            }

            const cafe = CAFES_BY_ID.get(cafeId);
            if (!cafe) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cafe ${cafeId} not found`);
            }

            // Rebuild: re-create session and re-populate cart
            const items = JSON.parse(part.itemsJson || '[]');
            const cartItems: ICartItem[] = items.map((item: any) => ({
                itemId:              item.menuItemId,
                quantity:            item.quantity,
                choicesByModifierId: deserializeModifiers(item.modifiers ?? []),
                specialInstructions: item.specialInstructions,
            }));

            const session = await CafeOrderSession.createAsync(cafe, cartItems);
            await session.populateCart();
            storeLiveSession(key, session);
            live = liveSessions.get(key)!;

            orderLog.info(`Session rebuilt for ${key}`);
        }

        // Prepare iframe — only call BoD if not already prepared.
        // If the session is already at initializeCardProcessor stage,
        // reuse the existing token instead of fetching a new one.
        if (live.session.lastCompletedStage !== SubmitOrderStage.initializeCardProcessor) {
            await live.session.prepareForIframe(iframeCssUrl);
        }
        resetSessionTTL(key);

        const siteToken = live.session.cardProcessorToken;
        const iframeUrl = live.session.getCardProcessorUrl(iframeCssUrl);
        const buyOnDemandOrderId = live.session.orderId;
        const buyOnDemandOrderNumber = live.session.orderNumber;

        if (!buyOnDemandOrderId || !buyOnDemandOrderNumber || !siteToken) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Order data not set after prepare');
        }

        // Update status to payment_pending
        await usePrismaWrite(prisma => prisma.orderCafePart.updateMany({
            where: { orderSessionId, cafeId },
            data:  { status: 'payment_pending' },
        }));

        const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

        return {
            siteToken,
            iframeUrl,
            buyOnDemandOrderId,
            buyOnDemandOrderNumber,
            expiresAt,
        };
    }

    static async completeOrder(
        userId: string,
        orderSessionId: string,
        cafeId: string,
        paymentToken: string,
        cardInfo: ICompleteOrderResult extends never ? never : {
            accountNumberMasked: string;
            cardIssuer: string;
            expirationYearMonth: string;
            cardHolderName: string;
            postalCode: string;
        },
    ): Promise<ICompleteOrderResult> {
        // Verify ownership + get payment identity
        const order = await usePrismaTransaction(async tx => {
            await ensureOrderBelongsToUser(tx, orderSessionId, userId);
            const part = await getCafePart(tx, orderSessionId, cafeId);
            if (part.status !== 'payment_pending') {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.BAD_REQUEST,
                    `Cannot complete order for cafe ${cafeId} in status '${part.status}'`,
                );
            }
            return tx.orderSession.findUnique({
                where: { id: orderSessionId },
                select: { alias: true, phoneNumberWithCountryCode: true },
            });
        });

        if (!order?.alias || !order?.phoneNumberWithCountryCode) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Payment identity (alias + phone) not set');
        }

        const phoneData = phone(order.phoneNumberWithCountryCode);
        if (!phoneData.isValid) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Invalid phone number');
        }

        const key = sessionKey({ orderSessionId, cafeId });
        const live = liveSessions.get(key);
        if (!live) {
            throw new ServiceError(
                SERVICE_ERROR_CODES.BAD_REQUEST,
                'Session expired. Please prepare payment again.',
            );
        }

        // Clean up session before completing (prevents double completion)
        cleanupLiveSession(key);

        try {
            await live.session.completeWithIframeToken({
                alias:        order.alias,
                phoneData,
                paymentToken,
                cardInfo,
            });

            const completedAt = new Date().toISOString();

            // Update DB
            await usePrismaWrite(prisma => prisma.orderCafePart.updateMany({
                where: { orderSessionId, cafeId },
                data:  {
                    status:      'completed',
                    completedAt: new Date(),
                },
            }));

            const orderNumber = live.session.orderNumber ?? 'Unknown';
            orderLog.info(`Order completed — orderNumber: ${orderNumber}`);

            return {
                buyOnDemandOrderNumber: orderNumber,
                waitTimeMin:            0,
                waitTimeMax:            0,
                completedAt,
            };
        } catch (err) {
            // Only mark as failed if the BoD close didn't succeed.
            // Post-close failures (e.g. SMS receipt) are non-fatal — the
            // order is already placed at that point.
            const closedSuccessfully = live.session.lastCompletedStage === 'closeOrder'
                || live.session.lastCompletedStage === 'sendTextReceipt'
                || live.session.lastCompletedStage === 'complete';

            if (closedSuccessfully) {
                orderLog.error(`Post-close failure (order already placed):`, err);
                await usePrismaWrite(prisma => prisma.orderCafePart.updateMany({
                    where: { orderSessionId, cafeId },
                    data:  {
                        status:      'completed',
                        completedAt: new Date(),
                        lastError:   `Post-close: ${err instanceof Error ? err.message : String(err)}`,
                    },
                }));

                return {
                    buyOnDemandOrderNumber: live.session.orderNumber ?? 'Unknown',
                    waitTimeMin:            0,
                    waitTimeMax:            0,
                    completedAt:            new Date().toISOString(),
                };
            }

            await usePrismaWrite(prisma => prisma.orderCafePart.updateMany({
                where: { orderSessionId, cafeId },
                data:  {
                    status:    'failed',
                    lastError: err instanceof Error ? err.message : String(err),
                    lastStage: 'complete',
                },
            }));
            throw err;
        }
    }

    static async abandonOrder(userId: string, orderSessionId: string): Promise<void> {
        await usePrismaTransaction(async tx => {
            await ensureOrderBelongsToUser(tx, orderSessionId, userId);

            const parts = await tx.orderCafePart.findMany({
                where: {
                    orderSessionId,
                    status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] },
                },
            });

            for (const part of parts) {
                const key = sessionKey({ orderSessionId, cafeId: part.cafeId });
                cleanupLiveSession(key);
            }

            await tx.orderCafePart.updateMany({
                where: {
                    orderSessionId,
                    status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] },
                },
                data: { status: 'abandoned' },
            });
        });

        orderLog.info(`Order ${orderSessionId} abandoned by user ${userId}`);
    }

    static async getActiveOrder(userId: string) {
        return CartStorageClient.getActiveOrderSummary(userId);
    }
}
