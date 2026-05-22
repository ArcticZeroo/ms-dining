import { usePrismaClient, usePrismaTransaction, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CafeOrderSession } from '../../cafe/session/order.js';
import { WaitTimeSession } from '../../cafe/session/wait-time.js';
import { CartStorageClient } from './cart.js';
import { OrderStorageClient } from './order.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import type { ICartItem } from '@msdining/common/models/cart';
import { SubmitOrderStage } from '@msdining/common/models/cart';
import type { ISerializedModifier } from '@msdining/common/models/cart';
import type {
    ICheckoutResult,
    ICheckoutCafeResult,
    IPreparePaymentResult,
    ICompleteOrderResult,
} from '@msdining/common/models/order';
import { phone } from 'phone';

const orderLog = getNamespaceLogger('Order');

interface ILiveSession {
    session: CafeOrderSession;
    refreshInterval: ReturnType<typeof setInterval>;
    ttlTimeout: ReturnType<typeof setTimeout>;
}

interface IStoredOrderItem {
    menuItemId: string;
    quantity: number;
    modifiers?: ISerializedModifier[];
    specialInstructions?: string;
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

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

const cleanupLiveSessionsForOrder = (orderSessionId: string) => {
    const prefix = `${orderSessionId}:`;
    for (const key of [...liveSessions.keys()]) {
        if (key.startsWith(prefix)) {
            cleanupLiveSession(key);
        }
    }
};

const deserializeModifiers = (modifiers: ISerializedModifier[]): Map<string, Set<string>> =>
    new Map(modifiers.map(mod => [mod.modifierId, new Set(mod.choiceIds)]));

export abstract class OrderOrchestrator {
    static async checkout(userId: string): Promise<ICheckoutResult> {
        const cartResponse = await CartStorageClient.getCart(userId);
        const availableItems = cartResponse.items.filter(item => item.isAvailable);

        if (availableItems.length == 0) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Cart is empty or has no available items');
        }

        const itemsByCafe = new Map<string, typeof availableItems>();
        for (const item of availableItems) {
            const cafeId = item.menuItem.cafeId;
            const existing = itemsByCafe.get(cafeId) ?? [];
            existing.push(item);
            itemsByCafe.set(cafeId, existing);
        }

        const orderSession = await OrderStorageClient.createOrderSession(userId);
        const cafeResults: ICheckoutCafeResult[] = [];

        for (const [cafeId, items] of itemsByCafe) {
            const cafe = CAFES_BY_ID.get(cafeId);
            if (!cafe) {
                orderLog.error(`Cafe ${cafeId} not found in config during checkout`);
                continue;
            }

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

                const waitTime = await WaitTimeSession.retrieveWaitTimeWithCartItems(
                    session.client,
                    [...session.rawCartItemsForWaitTime],
                );

                const itemsSnapshot = items.map(item => ({
                    menuItemId: item.menuItemId,
                    name:       item.menuItem.name,
                    quantity:   item.quantity,
                    price:      item.menuItem.price,
                    modifiers:  item.modifiers,
                }));

                await OrderStorageClient.createCafePart(orderSession.id, cafeId, {
                    buyOnDemandOrderId:     orderId,
                    buyOnDemandOrderNumber: orderNumber,
                    status:                 'pending',
                    subtotal:               session.orderTotalWithoutTax,
                    tax:                    session.orderTotalTax,
                    total:                  session.orderTotalWithTax,
                    waitTimeMin:            waitTime.minTime,
                    waitTimeMax:            waitTime.maxTime,
                    itemsJson:              JSON.stringify(itemsSnapshot),
                });

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

                await OrderStorageClient.createCafePart(orderSession.id, cafeId, {
                    status:    'failed',
                    lastError: err instanceof Error ? err.message : String(err),
                    lastStage: 'checkout',
                });
            }
        }

        if (cafeResults.length == 0) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'All cafe checkouts failed');
        }

        await usePrismaWrite(prisma => prisma.cartItem.deleteMany({
            where: { cartUserId: userId },
        }));

        return {
            orderSessionId: orderSession.id,
            cafeResults,
        };
    }

    static async preparePayment(
        userId: string,
        orderSessionId: string,
        cafeId: string,
        iframeCssUrl: string,
    ): Promise<IPreparePaymentResult> {
        await usePrismaTransaction(async prismaTx => {
            await OrderStorageClient.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);
            const part = await OrderStorageClient.getCafePart(prismaTx, orderSessionId, cafeId);
            if (part.status != 'pending' && part.status != 'payment_pending') {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.BAD_REQUEST,
                    `Cannot prepare payment for cafe ${cafeId} in status '${part.status}'`,
                );
            }
        });

        const key = sessionKey({ orderSessionId, cafeId });
        let live = liveSessions.get(key);

        if (!live) {
            orderLog.info(`Session expired for ${key}, rebuilding...`);
            const part = await usePrismaClient(prisma => OrderStorageClient.getCafePart(prisma, orderSessionId, cafeId));

            if (!part.buyOnDemandOrderId) {
                throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Cannot rebuild session — missing BoD order data');
            }

            const cafe = CAFES_BY_ID.get(cafeId);
            if (!cafe) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cafe ${cafeId} not found`);
            }

            const items = JSON.parse(part.itemsJson || '[]') as IStoredOrderItem[];
            const cartItems: ICartItem[] = items.map(item => ({
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

        if (live.session.lastCompletedStage != SubmitOrderStage.initializeCardProcessor) {
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

        await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'payment_pending');

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
        const order = await usePrismaTransaction(async prismaTx => {
            await OrderStorageClient.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);
            const part = await OrderStorageClient.getCafePart(prismaTx, orderSessionId, cafeId);
            if (part.status != 'payment_pending') {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.BAD_REQUEST,
                    `Cannot complete order for cafe ${cafeId} in status '${part.status}'`,
                );
            }
            return OrderStorageClient.getOrderSession(prismaTx, orderSessionId);
        });

        if (!order.alias || !order.phoneNumberWithCountryCode) {
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

        cleanupLiveSession(key);

        try {
            await live.session.completeWithIframeToken({
                alias:        order.alias,
                phoneData,
                paymentToken,
                cardInfo,
            });

            const completedAt = new Date().toISOString();

            await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                completedAt: new Date(),
            });

            const orderNumber = live.session.orderNumber ?? 'Unknown';
            orderLog.info(`Order completed — orderNumber: ${orderNumber}`);

            return {
                buyOnDemandOrderNumber: orderNumber,
                waitTimeMin:            0,
                waitTimeMax:            0,
                completedAt,
            };
        } catch (err) {
            const closedSuccessfully = live.session.lastCompletedStage == 'closeOrder'
                || live.session.lastCompletedStage == 'sendTextReceipt'
                || live.session.lastCompletedStage == 'complete';

            if (closedSuccessfully) {
                orderLog.error('Post-close failure (order already placed):', err);
                await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                    completedAt: new Date(),
                    lastError:   `Post-close: ${err instanceof Error ? err.message : String(err)}`,
                });

                return {
                    buyOnDemandOrderNumber: live.session.orderNumber ?? 'Unknown',
                    waitTimeMin:            0,
                    waitTimeMax:            0,
                    completedAt:            new Date().toISOString(),
                };
            }

            await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'failed', {
                lastError: err instanceof Error ? err.message : String(err),
                lastStage: 'complete',
            });
            throw err;
        }
    }

    static async abandonOrder(userId: string, orderSessionId: string): Promise<void> {
        await usePrismaTransaction(async prismaTx => {
            await OrderStorageClient.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);
        });

        cleanupLiveSessionsForOrder(orderSessionId);
        await OrderStorageClient.abandonOrder(userId, orderSessionId);

        orderLog.info(`Order ${orderSessionId} abandoned by user ${userId}`);
    }
}
