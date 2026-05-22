import { usePrismaClient, usePrismaTransaction, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CafeOrderSession } from '../../cafe/session/order.js';
import { fetchWaitTimeWithCartItems } from '../../cafe/buy-ondemand/wait-time.js';
import { CartStorageClient } from './cart.js';
import { OrderStorageClient } from './order.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import { LockedExpiringMap } from '../../../../shared/lock/map.js';
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

const liveSessions = new LockedExpiringMap<string, CafeOrderSession>(SESSION_TTL_MS);

// Periodic token refresh — goes through all live sessions in parallel
setInterval(() => {
    const entries = [...liveSessions.entries()];
    if (entries.length === 0) return;

    orderLog.info(`Refreshing tokens for ${entries.length} live session(s)...`);
    Promise.all(
        entries.map(([key]) =>
            liveSessions.update(key, async (session) => {
                if (!session) return undefined;
                try {
                    await session.client.refreshLogin();
                } catch (err) {
                    orderLog.error(`Failed to refresh token for session ${key}:`, err);
                }
                return session;
            }, { preserveTtl: true })
        )
    ).catch(err => orderLog.error('Token refresh sweep failed:', err));
}, TOKEN_REFRESH_INTERVAL_MS);

const sessionKey = ({ orderSessionId, cafeId }: { orderSessionId: string; cafeId: string }) =>
    `${orderSessionId}:${cafeId}`;

const deserializeModifiers = (modifiers: ISerializedModifier[]): Map<string, Set<string>> =>
    new Map(modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)]));

export abstract class OrderOrchestrator {
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

            const waitTime = await fetchWaitTimeWithCartItems(
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

    private static async getOrRebuildLiveSession(orderSessionId: string, cafeId: string): Promise<CafeOrderSession> {
        const key = sessionKey({ orderSessionId, cafeId });
        return liveSessions.getOrInsert(key, async () => {
            orderLog.info(`Session expired for ${key}, rebuilding...`);
            const part = await usePrismaClient(prisma => OrderStorageClient.getCafePart(prisma, orderSessionId, cafeId));

            if (!part.buyOnDemandOrderId) {
                throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Cannot rebuild session — missing BoD order data');
            }

            const cafe = CAFES_BY_ID.get(cafeId);
            if (!cafe) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cafe ${cafeId} not found`);
            }

            const cartItems: ICartItem[] = part.items.map(item => ({
                itemId:              item.menuItemId,
                quantity:            item.quantity,
                choicesByModifierId: new Map(
                    Object.entries(
                        item.modifiers.reduce<Record<string, Set<string>>>((acc, mod) => {
                            (acc[mod.modifierId] ??= new Set()).add(mod.choiceId);
                            return acc;
                        }, {})
                    )
                ),
                specialInstructions: item.specialInstructions ?? undefined,
            }));

            const session = await CafeOrderSession.createAsync(cafe, cartItems);
            await session.populateCart();

            orderLog.info(`Session rebuilt for ${key}`);
            return session;
        });
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

        const cafeResults: ICheckoutCafeResult[] = [];
        await Promise.all(checkoutResults.map(async result => {
            if (!result.cafeResult || !result.session) {
                return;
            }

            const key = sessionKey({ orderSessionId: orderSession.id, cafeId: result.cafeId });
            await liveSessions.update(key, () => result.session);
            orderLog.info(
                `{${result.cafeName}} Checkout complete — orderId: ${result.cafeResult.buyOnDemandOrderId}, orderNumber: ${result.cafeResult.buyOnDemandOrderNumber}`,
            );
            cafeResults.push(result.cafeResult);
        }));

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

        const session = await this.getOrRebuildLiveSession(orderSessionId, cafeId);
        if (session.lastCompletedStage != SubmitOrderStage.initializeCardProcessor) {
            await session.prepareForIframe(iframeCssUrl);
        }

        const siteToken = session.cardProcessorToken;
        const iframeUrl = session.getCardProcessorUrl(iframeCssUrl);
        const buyOnDemandOrderId = session.orderId;
        const buyOnDemandOrderNumber = session.orderNumber;

        if (!buyOnDemandOrderId || !buyOnDemandOrderNumber || !siteToken) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Order data not set after prepare');
        }

        await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'payment_pending');

        return {
            siteToken,
            iframeUrl,
            buyOnDemandOrderId,
            buyOnDemandOrderNumber,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
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
        let extractedSession: CafeOrderSession | undefined;
        await liveSessions.update(key, (existing) => {
            extractedSession = existing;
            return undefined; // atomically remove from map
        });

        if (!extractedSession) {
            throw new ServiceError(
                SERVICE_ERROR_CODES.BAD_REQUEST,
                'Session expired. Please prepare payment again.',
            );
        }

        try {
            await extractedSession.completeOrderAfterIframePayment({
                alias:        order.alias,
                phoneData,
                paymentToken,
                cardInfo,
            });

            const completedAt = new Date();

            await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                completedAt,
            });

            const orderNumber = extractedSession.orderNumber ?? 'Unknown';
            orderLog.info(`Order completed — orderNumber: ${orderNumber}`);

            return {
                buyOnDemandOrderNumber: orderNumber,
                waitTimeMin:            0,
                waitTimeMax:            0,
                completedAt:            completedAt.toISOString(),
            };
        } catch (err) {
            const closedSuccessfully = extractedSession.lastCompletedStage == 'closeOrder'
                || extractedSession.lastCompletedStage == 'sendTextReceipt'
                || extractedSession.lastCompletedStage == 'complete';

            if (closedSuccessfully) {
                orderLog.error('Post-close failure (order already placed):', err);

                const completedAt = new Date();
                await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                    completedAt,
                    lastError: `Post-close: ${err instanceof Error ? err.message : String(err)}`,
                });

                return {
                    buyOnDemandOrderNumber: extractedSession.orderNumber ?? 'Unknown',
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

        await liveSessions.deleteWhere((key) => key.startsWith(`${orderSessionId}:`));
        await OrderStorageClient.abandonOrder(userId, orderSessionId);

        orderLog.info(`Order ${orderSessionId} abandoned by user ${userId}`);
    }
}
