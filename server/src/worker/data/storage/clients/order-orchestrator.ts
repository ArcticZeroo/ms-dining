import { usePrismaClient, usePrismaTransaction } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CafeOrderSession } from '../../cafe/session/order.js';
import { FakeCafeOrderSession } from '../../cafe/session/fake-order-session.js';
import type { IOrderSession } from '../../cafe/session/order-session.js';
import type { BuyOnDemandClient } from '../../cafe/buy-ondemand/buy-ondemand-client.js';
import { fetchWaitTimeWithCartItems } from '../../cafe/buy-ondemand/wait-time.js';
import { OrderStorageClient } from './order.js';
import { CartStorageClient } from './cart.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import { LockedExpiringMap } from '../../../../shared/lock/map.js';
import type { ICartItem, IRguestCardInfo, OrderCafePartStatus } from '@msdining/common/models/cart';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import { ACTIVE_ORDER_CAFE_PART_STATUSES, SubmitOrderStage } from '@msdining/common/models/cart';
import type {
    IStartCheckoutResult,
    IPreparePaymentResult,
    ICompleteOrderResultDTO,
} from '@msdining/common/models/order';
import { phone, type PhoneValidResult } from 'phone';

const orderLog = getNamespaceLogger('Order');
const isFakeOrdering = process.env.FAKE_ORDERING === 'true';

if (isFakeOrdering) {
    orderLog.info('⚠️  FAKE_ORDERING is enabled — no real charges will be made');
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

const liveSessions = new LockedExpiringMap<string, IOrderSession>(SESSION_TTL_MS);

// Periodic token refresh — goes through all live sessions in parallel
setInterval(() => {
    const entries = [...liveSessions.entries()];
    if (entries.length === 0) return;

    orderLog.info(`Refreshing tokens for ${entries.length} live session(s)...`);
    Promise.all(
        entries.map(([key]) =>
            liveSessions.updateWithoutRefresh(key, async (session) => {
                if (!session) return undefined;
                try {
                    await session.client.refreshLogin();
                } catch (err) {
                    orderLog.error(`Failed to refresh token for session ${key}:`, err);
                }
                return session;
            })
        )
    ).catch(err => orderLog.error('Token refresh sweep failed:', err));
}, TOKEN_REFRESH_INTERVAL_MS);

const sessionKey = ({ orderSessionId, cafeId }: { orderSessionId: string; cafeId: string }) =>
    `${orderSessionId}:${cafeId}`;

const groupModifierChoices = (choices: Array<{ modifierId: string; choiceId: string }>): Map<string, Set<string>> => {
    const result = new Map<string, Set<string>>();
    for (const { modifierId, choiceId } of choices) {
        const existing = result.get(modifierId);
        if (existing) {
            existing.add(choiceId);
        } else {
            result.set(modifierId, new Set([choiceId]));
        }
    }
    return result;
};

const getCafeOrThrow = (cafeId: string) => {
    const cafe = CAFES_BY_ID.get(cafeId);
    if (!cafe) {
        throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cafe ${cafeId} not found`);
    }
    return cafe;
};

/**
 * Creates an order session, logs in, and populates the cart.
 * Uses FakeCafeOrderSession when FAKE_ORDERING is enabled.
 */
const createPopulatedSession = async (cafeId: string, cartItems: ICartItem[]): Promise<IOrderSession> => {
    const cafe = getCafeOrThrow(cafeId);

    if (isFakeOrdering) {
        const session = new FakeCafeOrderSession(cafe, cartItems);
        await session.populateCart();
        return session;
    }

    const session = await CafeOrderSession.createAsync(cafe, cartItems);
    await session.populateCart();

    if (!session.orderId || !session.orderNumber) {
        throw new Error('Order ID or order number not set after cart population');
    }

    return session;
};

export abstract class OrderOrchestrator {
    /**
     * Validates ownership and returns the cafe part with a typed status.
     */
    private static async useOrderCafePart(userId: string, orderSessionId: string, cafeId: string) {
        return usePrismaTransaction(async prismaTx => {
            await OrderStorageClient.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);
            const part = await OrderStorageClient.getCafePart(prismaTx, orderSessionId, cafeId);
            return { ...part, status: part.status as OrderCafePartStatus };
        });
    }

    /**
     * Single path for getting a live session — creates one if it doesn't exist
     * by reading the cart items from DB. Updates DB with new BoD order data.
     */
    private static async getOrCreateLiveSession(orderSessionId: string, cafeId: string): Promise<IOrderSession> {
        const key = sessionKey({ orderSessionId, cafeId });
        return liveSessions.getOrInsert(key, async () => {
            const part = await usePrismaClient(prisma => OrderStorageClient.getCafePart(prisma, orderSessionId, cafeId));

            const cartItems: ICartItem[] = part.items.map(item => ({
                itemId:              item.menuItemId,
                quantity:            item.quantity,
                choicesByModifierId: groupModifierChoices(item.modifierChoices),
                specialInstructions: item.specialInstructions ?? undefined,
            }));

            const session = await createPopulatedSession(cafeId, cartItems);

            await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, part.status as OrderCafePartStatus, {
                buyOnDemandOrderId:     session.orderId!,
                buyOnDemandOrderNumber: session.orderNumber!,
            });

            orderLog.info(`{${getCafeOrThrow(cafeId).name}} Live session created — orderId: ${session.orderId}`);
            return session;
        });
    }

    static async startCheckout(userId: string, alias: string, phoneNumberWithCountryCode: string): Promise<IStartCheckoutResult> {
        const { orderSessionId, cafeIds } = await OrderStorageClient.startOrder(userId, alias, phoneNumberWithCountryCode);

        // Create live BoD sessions in parallel — fails fast if any cafe fails
        await Promise.all(
            cafeIds.map(async (cafeId) => {
                const session = await this.getOrCreateLiveSession(orderSessionId, cafeId);

                const waitTime: IWaitTimeResponse = isFakeOrdering
                    ? { minTime: 5, maxTime: 10 }
                    : await fetchWaitTimeWithCartItems(
                        session.client as BuyOnDemandClient,
                        [...session.rawCartItemsForWaitTime],
                    );

                await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'pending', {
                    subtotal:    session.orderTotalWithoutTax,
                    tax:         session.orderTotalTax,
                    total:       session.orderTotalWithTax,
                    waitTimeMin: waitTime.minTime,
                    waitTimeMax: waitTime.maxTime,
                });
            }),
        );

        // Return the full active order summary (with enriched items)
        const activeOrder = await CartStorageClient.getActiveOrderSummary(userId);
        if (!activeOrder) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Active order not found after checkout');
        }
        return activeOrder;
    }

    static async preparePayment(
        userId: string,
        orderSessionId: string,
        cafeId: string,
        iframeCssUrl: string,
    ): Promise<IPreparePaymentResult> {
        const part = await this.useOrderCafePart(userId, orderSessionId, cafeId);
        if (part.status !== 'pending' && part.status !== 'payment_pending') {
            throw new ServiceError(
                SERVICE_ERROR_CODES.BAD_REQUEST,
                `Cannot prepare payment for cafe ${cafeId} in status '${part.status}'`,
            );
        }

        // Identity must be set before preparing payment — the close-order call
        // uses it immediately after the iframe completes.
        const order = await usePrismaClient(prisma =>
            OrderStorageClient.getOrderSession(prisma, orderSessionId),
        );
        if (!order.alias || !order.phoneNumberWithCountryCode) {
            throw new ServiceError(
                SERVICE_ERROR_CODES.BAD_REQUEST,
                'Payment identity (alias + phone) must be set before preparing payment',
            );
        }

        const session = await this.getOrCreateLiveSession(orderSessionId, cafeId);
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

    /**
     * Runs the BoD completion flow on a session. Returns the session back
     * if it should be kept (failure before close), or undefined to remove it
     * (success or unrecoverable post-close failure).
     */
    private static async executeCompletion(
        session: IOrderSession,
        orderSessionId: string,
        cafeId: string,
        params: {
            alias: string;
            phoneData: PhoneValidResult;
            paymentToken: string;
            cardInfo: IRguestCardInfo;
        },
    ): Promise<{ result: ICompleteOrderResultDTO; keepSession: boolean }> {
        try {
            const waitTime = await session.completeOrderAfterIframePayment(params);

            const completedAt = new Date();
            await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                completedAt,
                waitTimeMin: waitTime.minTime,
                waitTimeMax: waitTime.maxTime,
            });

            const orderNumber = session.orderNumber ?? 'Unknown';
            orderLog.info(`Order completed — orderNumber: ${orderNumber}`);

            return {
                keepSession: false,
                result: {
                    buyOnDemandOrderNumber: orderNumber,
                    waitTimeMin:            waitTime.minTime,
                    waitTimeMax:            waitTime.maxTime,
                    completedAt:            completedAt.toISOString(),
                },
            };
        } catch (err) {
            const closedSuccessfully = session.lastCompletedStage == 'closeOrder'
                || session.lastCompletedStage == 'sendTextReceipt'
                || session.lastCompletedStage == 'complete';

            if (closedSuccessfully) {
                orderLog.error('Post-close failure (order already placed):', err);

                const completedAt = new Date();
                // Fetch stored wait time since we don't have the fresh one
                const part = await usePrismaClient(prisma =>
                    OrderStorageClient.getCafePart(prisma, orderSessionId, cafeId),
                );
                await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                    completedAt,
                    lastError: `Post-close: ${err instanceof Error ? err.message : String(err)}`,
                });

                return {
                    keepSession: false,
                    result: {
                        buyOnDemandOrderNumber: session.orderNumber ?? 'Unknown',
                        waitTimeMin:            part.waitTimeMin ?? 0,
                        waitTimeMax:            part.waitTimeMax ?? 0,
                        completedAt:            completedAt.toISOString(),
                    },
                };
            }

            // Pre-close failure — keep session for retry
            await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'payment_pending', {
                lastError: err instanceof Error ? err.message : String(err),
                lastStage: 'complete',
            });
            throw err;
        }
    }

    static async completeOrder(
        userId: string,
        orderSessionId: string,
        cafeId: string,
        paymentToken: string,
        cardInfo: IRguestCardInfo,
    ): Promise<ICompleteOrderResultDTO> {
        const part = await this.useOrderCafePart(userId, orderSessionId, cafeId);
        if (part.status !== 'payment_pending') {
            throw new ServiceError(
                SERVICE_ERROR_CODES.BAD_REQUEST,
                `Cannot complete order for cafe ${cafeId} in status '${part.status}'`,
            );
        }

        const order = await usePrismaClient(prisma =>
            OrderStorageClient.getOrderSession(prisma, orderSessionId),
        );

        if (!order.alias || !order.phoneNumberWithCountryCode) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Payment identity (alias + phone) not set');
        }

        const phoneData = phone(order.phoneNumberWithCountryCode);
        if (!phoneData.isValid) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Invalid phone number');
        }

        const key = sessionKey({ orderSessionId, cafeId });
        let completionResult: ICompleteOrderResultDTO | undefined;

        await liveSessions.update(key, async (session) => {
            if (!session) {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.BAD_REQUEST,
                    'Session expired. Please prepare payment again.',
                );
            }

            const { result, keepSession } = await this.executeCompletion(
                session, orderSessionId, cafeId,
                { alias: order.alias!, phoneData, paymentToken, cardInfo },
            );

            completionResult = result;
            return keepSession ? session : undefined;
        });

        return completionResult!;
    }

    static async abandonRemainingCafes(userId: string, orderSessionId: string): Promise<void> {
        // Get the cafe IDs so we can lock each session
        const cafeParts = await usePrismaTransaction(async prismaTx => {
            await OrderStorageClient.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);
            return prismaTx.orderCafePart.findMany({
                where:   { orderSessionId, status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] } },
                select:  { cafeId: true },
            });
        });

        // Acquire each session lock and remove — prevents concurrent completeOrder
        await Promise.all(cafeParts.map(({ cafeId }) => {
            const key = sessionKey({ orderSessionId, cafeId });
            return liveSessions.update(key, () => undefined);
        }));

        await OrderStorageClient.abandonRemainingCafes(userId, orderSessionId);
        orderLog.info(`Order ${orderSessionId}: abandoned ${cafeParts.length} remaining cafe(s), items returned to cart`);
    }
}
