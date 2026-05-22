import { usePrismaClient, usePrismaTransaction } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CafeOrderSession } from '../../cafe/session/order.js';
import { fetchWaitTimeWithCartItems } from '../../cafe/buy-ondemand/wait-time.js';
import { OrderStorageClient } from './order.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import { LockedExpiringMap } from '../../../../shared/lock/map.js';
import type { ICartItem, IRguestCardInfo, OrderCafePartStatus } from '@msdining/common/models/cart';
import { SubmitOrderStage } from '@msdining/common/models/cart';
import type {
    ICheckoutResult,
    ICheckoutCafeResult,
    IPreparePaymentResult,
    ICompleteOrderResult,
} from '@msdining/common/models/order';
import { phone, type PhoneValidResult } from 'phone';

const orderLog = getNamespaceLogger('Order');

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
 * Creates a BoD session, logs in, and populates the cart.
 */
const createPopulatedSession = async (cafeId: string, cartItems: ICartItem[]): Promise<CafeOrderSession> => {
    const cafe = getCafeOrThrow(cafeId);
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
    private static async getOrCreateLiveSession(orderSessionId: string, cafeId: string): Promise<CafeOrderSession> {
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

    static async startCheckout(userId: string): Promise<ICheckoutResult> {
        const { orderSessionId, cafeIds } = await OrderStorageClient.startOrder(userId);

        // Create live BoD sessions in parallel — fails fast if any cafe fails
        const cafeResults = await Promise.all(
            cafeIds.map(async (cafeId): Promise<ICheckoutCafeResult> => {
                const session = await this.getOrCreateLiveSession(orderSessionId, cafeId);

                const waitTime = await fetchWaitTimeWithCartItems(
                    session.client,
                    [...session.rawCartItemsForWaitTime],
                );

                await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'pending', {
                    subtotal:    session.orderTotalWithoutTax,
                    tax:         session.orderTotalTax,
                    total:       session.orderTotalWithTax,
                    waitTimeMin: waitTime.minTime,
                    waitTimeMax: waitTime.maxTime,
                });

                return {
                    cafeId,
                    buyOnDemandOrderId:     session.orderId!,
                    buyOnDemandOrderNumber: session.orderNumber!,
                    subtotal:               session.orderTotalWithoutTax,
                    tax:                    session.orderTotalTax,
                    total:                  session.orderTotalWithTax,
                    waitTimeMin:            waitTime.minTime,
                    waitTimeMax:            waitTime.maxTime,
                };
            }),
        );

        return { orderSessionId, cafeResults };
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
        session: CafeOrderSession,
        orderSessionId: string,
        cafeId: string,
        waitTime: { min: number | null; max: number | null },
        params: {
            alias: string;
            phoneData: PhoneValidResult;
            paymentToken: string;
            cardInfo: IRguestCardInfo;
        },
    ): Promise<{ result: ICompleteOrderResult; keepSession: boolean }> {
        try {
            await session.completeOrderAfterIframePayment(params);

            const completedAt = new Date();
            await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', { completedAt });

            const orderNumber = session.orderNumber ?? 'Unknown';
            orderLog.info(`Order completed — orderNumber: ${orderNumber}`);

            return {
                keepSession: false,
                result: {
                    buyOnDemandOrderNumber: orderNumber,
                    waitTimeMin:            waitTime.min ?? 0,
                    waitTimeMax:            waitTime.max ?? 0,
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
                await OrderStorageClient.updateCafePartStatus(orderSessionId, cafeId, 'completed', {
                    completedAt,
                    lastError: `Post-close: ${err instanceof Error ? err.message : String(err)}`,
                });

                return {
                    keepSession: false,
                    result: {
                        buyOnDemandOrderNumber: session.orderNumber ?? 'Unknown',
                        waitTimeMin:            waitTime.min ?? 0,
                        waitTimeMax:            waitTime.max ?? 0,
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
    ): Promise<ICompleteOrderResult> {
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
        let completionResult: ICompleteOrderResult | undefined;

        await liveSessions.update(key, async (session) => {
            if (!session) {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.BAD_REQUEST,
                    'Session expired. Please prepare payment again.',
                );
            }

            const { result, keepSession } = await this.executeCompletion(
                session, orderSessionId, cafeId,
                { min: part.waitTimeMin, max: part.waitTimeMax },
                { alias: order.alias!, phoneData, paymentToken, cardInfo },
            );

            completionResult = result;
            return keepSession ? session : undefined;
        });

        return completionResult!;
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
