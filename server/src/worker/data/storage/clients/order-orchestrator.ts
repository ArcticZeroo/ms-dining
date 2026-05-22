import { usePrismaClient, usePrismaTransaction, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CafeOrderSession } from '../../cafe/session/order.js';
import { WaitTimeSession } from '../../cafe/session/wait-time.js';
import { CartStorageClient } from './cart.js';
import { OrderStorageClient } from './order.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import type { ICartItem, ICartItemRecord, ISerializedModifier } from '@msdining/common/models/cart';
import { SubmitOrderStage } from '@msdining/common/models/cart';
import type {
    ICheckoutResult,
    ICheckoutCafeResult,
    IPreparePaymentResult,
    ICompleteOrderResult,
} from '@msdining/common/models/order';
import { phone } from 'phone';

const orderLog = getNamespaceLogger('Order');

type ICreateCafePartInput = Parameters<typeof OrderStorageClient.createCafePart>[2];

interface ILiveSession {
    session: CafeOrderSession;
    refreshInterval: ReturnType<typeof setInterval>;
    ttlTimeout: ReturnType<typeof setTimeout>;
}

interface IStoredOrderItem {
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    modifiers: ISerializedModifier[];
    specialInstructions?: string | null;
}

interface ICheckoutCafeProcessingResult {
    cafeId: string;
    cafeName: string;
    cartItems: ICartItemRecord[];
    cafePart: ICreateCafePartInput;
    cafeResult?: ICheckoutCafeResult;
    session?: CafeOrderSession;
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
    new Map(modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)]));

export abstract class OrderOrchestrator {
    private static getSessionExpiry(): Date {
        return new Date(Date.now() + SESSION_TTL_MS);
    }

    private static async startCheckoutForCafe(
        cafeId: string,
        cartItems: ICartItemRecord[],
    ): Promise<ICheckoutCafeProcessingResult> {
        const cafe = CAFES_BY_ID.get(cafeId);
        if (!cafe) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, `Cafe ${cafeId} not found in config during checkout`);
        }

        const buyOnDemandCartItems: ICartItem[] = cartItems.map(item => ({
            itemId:              item.menuItemId,
            quantity:            item.quantity,
            choicesByModifierId: deserializeModifiers(item.modifiers),
            specialInstructions: item.specialInstructions ?? undefined,
        }));

        try {
            const session = await CafeOrderSession.createAsync(cafe, buyOnDemandCartItems);
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

            return {
                cafeId,
                cafeName: cafe.name,
                cartItems,
                session,
                cafeResult: {
                    cafeId,
                    buyOnDemandOrderId:     orderId,
                    buyOnDemandOrderNumber: orderNumber,
                    subtotal:               session.orderTotalWithoutTax,
                    tax:                    session.orderTotalTax,
                    total:                  session.orderTotalWithTax,
                    waitTimeMin:            waitTime.minTime,
                    waitTimeMax:            waitTime.maxTime,
                },
                cafePart: {
                    buyOnDemandOrderId:     orderId,
                    buyOnDemandOrderNumber: orderNumber,
                    status:                 'pending',
                    subtotal:               session.orderTotalWithoutTax,
                    tax:                    session.orderTotalTax,
                    total:                  session.orderTotalWithTax,
                    waitTimeMin:            waitTime.minTime,
                    waitTimeMax:            waitTime.maxTime,
                    cartItems,
                },
            };
        } catch (err) {
            orderLog.error(`{${cafe.name}} Checkout failed:`, err);

            return {
                cafeId,
                cafeName: cafe.name,
                cartItems,
                cafePart: {
                    status:    'failed',
                    lastError: err instanceof Error ? err.message : String(err),
                    lastStage: 'startCheckout',
                    cartItems,
                },
            };
        }
    }

    private static async getOrRebuildLiveSession(orderSessionId: string, cafeId: string): Promise<ILiveSession> {
        const key = sessionKey({ orderSessionId, cafeId });
        const live = liveSessions.get(key);
        if (live) {
            return live;
        }

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
            specialInstructions: item.specialInstructions ?? undefined,
        }));

        const session = await CafeOrderSession.createAsync(cafe, cartItems);
        await session.populateCart();
        storeLiveSession(key, session);

        const rebuiltLive = liveSessions.get(key);
        if (!rebuiltLive) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, `Failed to rebuild live session for ${key}`);
        }

        orderLog.info(`Session rebuilt for ${key}`);
        return rebuiltLive;
    }

    static async startCheckout(userId: string): Promise<ICheckoutResult> {
        const cart = await CartStorageClient.getCart(userId);
        const availableItems = cart.items.filter(item => item.isAvailable);

        if (availableItems.length == 0) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Cart is empty or has no available items');
        }

        const itemsByCafe = new Map<string, ICartItemRecord[]>();
        for (const item of availableItems) {
            const cafeId = item.menuItem.cafeId;
            const existing = itemsByCafe.get(cafeId) ?? [];
            existing.push(item);
            itemsByCafe.set(cafeId, existing);
        }

        const orderSession = await OrderStorageClient.createOrderSession(userId);
        const checkoutResults = await Promise.all(
            [...itemsByCafe].map(([cafeId, cartItems]) => this.startCheckoutForCafe(cafeId, cartItems)),
        );

        await OrderStorageClient.createCafeParts(
            orderSession.id,
            checkoutResults.map(result => ({
                cafeId: result.cafeId,
                ...result.cafePart,
            })),
        );

        const cafeResults = checkoutResults.flatMap(result => {
            if (!result.cafeResult || !result.session) {
                return [];
            }

            const key = sessionKey({ orderSessionId: orderSession.id, cafeId: result.cafeId });
            storeLiveSession(key, result.session);
            orderLog.info(
                `{${result.cafeName}} Checkout complete — orderId: ${result.cafeResult.buyOnDemandOrderId}, orderNumber: ${result.cafeResult.buyOnDemandOrderNumber}`,
            );
            return [result.cafeResult];
        });

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

        const live = await this.getOrRebuildLiveSession(orderSessionId, cafeId);
        if (live.session.lastCompletedStage != SubmitOrderStage.initializeCardProcessor) {
            await live.session.prepareForIframe(iframeCssUrl);
        }

        const key = sessionKey({ orderSessionId, cafeId });
        resetSessionTTL(key);

        const siteToken = live.session.cardProcessorToken;
        const iframeUrl = live.session.getCardProcessorUrl(iframeCssUrl);
        const buyOnDemandOrderId = live.session.orderId;
        const buyOnDemandOrderNumber = live.session.orderNumber;

        if (!buyOnDemandOrderId || !buyOnDemandOrderNumber || !siteToken) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Order data not set after prepare');
        }

        await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'payment_pending');

        const expiresAt = this.getSessionExpiry();

        return {
            siteToken,
            iframeUrl,
            buyOnDemandOrderId,
            buyOnDemandOrderNumber,
            expiresAt: expiresAt.toISOString(),
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
            await live.session.completeOrderAfterIframePayment({
                alias:        order.alias,
                phoneData,
                paymentToken,
                cardInfo,
            });

            const completedAt = new Date();

            await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                completedAt,
            });

            const orderNumber = live.session.orderNumber ?? 'Unknown';
            orderLog.info(`Order completed — orderNumber: ${orderNumber}`);

            return {
                buyOnDemandOrderNumber: orderNumber,
                waitTimeMin:            0,
                waitTimeMax:            0,
                completedAt:            completedAt.toISOString(),
            };
        } catch (err) {
            const closedSuccessfully = live.session.lastCompletedStage == 'closeOrder'
                || live.session.lastCompletedStage == 'sendTextReceipt'
                || live.session.lastCompletedStage == 'complete';

            if (closedSuccessfully) {
                orderLog.error('Post-close failure (order already placed):', err);

                const completedAt = new Date();
                await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                    completedAt,
                    lastError: `Post-close: ${err instanceof Error ? err.message : String(err)}`,
                });

                return {
                    buyOnDemandOrderNumber: live.session.orderNumber ?? 'Unknown',
                    waitTimeMin:            0,
                    waitTimeMax:            0,
                    completedAt:            completedAt.toISOString(),
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
