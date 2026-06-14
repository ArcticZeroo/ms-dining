import { SERVICE_ERROR_CODES, ServiceError } from '../../../shared/rpc/errors.js';
import type { IOrderSession } from '../cafe/session/order-session.js';
import type { BuyOnDemandClient } from '../../../shared/buy-ondemand/buy-ondemand-client.js';
import { fetchWaitTimeWithCartItems } from '../cafe/buy-ondemand/wait-time.js';
import { OrderStorageClient } from '../storage/clients/order/order.js';
import { getNamespaceLogger } from '../../../shared/util/log.js';
import type { ICartItemRecord, IPaymentCardInfo } from '@msdining/common/models/cart';
import { SubmitOrderStage } from '@msdining/common/models/cart';
import type {
    ICafeOrderDTO,
    ICompleteOrderResultDTO,
    IOrderItem,
    IPreparePaymentResult,
} from '@msdining/common/models/order';
import type { ICartEstimateResponse, IWaitTimeResponse } from '@msdining/common/models/http';
import { phone } from 'phone';
import { isFakeOrderingEnabled } from '../../../shared/constants/env.js';
import { completeOrder, getPaymentSession, keepalivePrewarm, ORDER_SESSION_TTL_MS, getOrCreatePrewarmedSession } from './order-session-manager.js';
import type { ISynthesisFlags } from '../../../shared/services/order.js';
import { trackDbPersistFailed, trackPostCloseRecovery, trackPreKitchenFailure } from '../../../shared/ordering/order-telemetry.js';
import { getServices } from '../../../shared/services/registry.js';
import { CAFES_BY_ID } from '../../../shared/constants/cafes.js';

const orderLog = getNamespaceLogger('Order');

if (isFakeOrderingEnabled) {
    orderLog.info('⚠️  FAKE_ORDERING is enabled — no real charges will be made');
}

const toCompletionFinancials = (
    session: IOrderSession,
    waitTime: IWaitTimeResponse,
    completedAt: Date,
) => {
    if (!session.orderId || !session.orderNumber) {
        throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Order data not set on session');
    }

    return {
        buyOnDemandOrderId:     session.orderId,
        buyOnDemandOrderNumber: session.orderNumber,
        subtotal:               session.orderTotalWithoutTax,
        tax:                    session.orderTotalTax,
        total:                  session.orderTotalWithTax,
        waitTimeMin:            waitTime.minTime,
        waitTimeMax:            waitTime.maxTime,
        completedAt,
    };
};

const wasOrderSentToKitchen = (session: IOrderSession) =>
    session.lastCompletedStage === SubmitOrderStage.sentToKitchen
	|| session.lastCompletedStage === SubmitOrderStage.sendTextReceipt
	|| session.lastCompletedStage === SubmitOrderStage.complete;

const cartItemToOrderItem = (item: ICartItemRecord): IOrderItem => ({
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    specialInstructions: item.specialInstructions ?? undefined,
    modifiers:           item.modifiers,
});

export abstract class OrderOrchestrator {
    static async preparePayment(
        userId: string,
        cafeId: string,
        items: IOrderItem[],
        iframeCssUrl: string
    ): Promise<IPreparePaymentResult> {
        const [pendingOrderId, session] = await getPaymentSession({
            userId,
            cafeId,
            items,
            iframeCssUrl
        });

        const siteToken = session.cardProcessorToken;
        const iframeUrl = session.getCardProcessorUrl(iframeCssUrl);

        if (!siteToken || !iframeUrl || !session.orderId || !session.orderNumber) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Failed to prepare order session');
        }

        return {
            pendingOrderId,
            siteToken,
            iframeUrl,
            buyOnDemandOrderId:     session.orderId,
            buyOnDemandOrderNumber: session.orderNumber,
            expiresAt:              new Date(Date.now() + ORDER_SESSION_TTL_MS).toISOString(),
        };
    }

    static async completeOrder(
        userId: string,
        pendingOrderId: string,
        paymentToken: string,
        cardInfo: IPaymentCardInfo,
        alias: string,
        phoneNumberWithCountryCode: string,
    ): Promise<ICompleteOrderResultDTO> {
        const phoneData = phone(phoneNumberWithCountryCode);
        if (!phoneData.isValid) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Invalid phone number');
        }

        return completeOrder(pendingOrderId, async (session) => {
            let waitTime: IWaitTimeResponse;
            try {
                waitTime = await session.completeOrderAfterPaymentAsync({
                    alias,
                    phoneData,
                    paymentToken,
                    cardInfo,
                });
            } catch (err) {
                if (!wasOrderSentToKitchen(session)) {
                    trackPreKitchenFailure(pendingOrderId, session.lastCompletedStage, err);
                    throw err;
                }

                trackPostCloseRecovery(pendingOrderId, session.lastCompletedStage, err);
                waitTime = await session.retrieveWaitTime().catch(waitErr => {
                    orderLog.error(`Failed to fetch fallback wait time for pending order ${pendingOrderId}:`, waitErr);
                    return { minTime: 0, maxTime: 0 };
                });
            }

            const financials = toCompletionFinancials(session, waitTime, new Date());
            try {
                await OrderStorageClient.createCompletedOrder(pendingOrderId, userId, financials);
            } catch (err) {
                trackDbPersistFailed(pendingOrderId, financials.buyOnDemandOrderNumber, err);
            }
            orderLog.info(`Order completed — orderNumber: ${financials.buyOnDemandOrderNumber}`);

            return {
                buyOnDemandOrderId:     financials.buyOnDemandOrderId,
                buyOnDemandOrderNumber: financials.buyOnDemandOrderNumber,
                waitTimeMin:            financials.waitTimeMin,
                waitTimeMax:            financials.waitTimeMax,
                completedAt:            financials.completedAt.toISOString(),
            };
        });
    }

    static async getCompletedOrdersToday(userId: string): Promise<ICafeOrderDTO[]> {
        return OrderStorageClient.getCompletedOrdersToday(userId);
    }

    static async getCartEstimate(cafeId: string, userId: string): Promise<ICartEstimateResponse> {
        if (!CAFES_BY_ID.has(cafeId)) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cafe ${cafeId} not found`);
        }

        const cart = await getServices().data.cart.getCart({ userId });
        const cafeGroup = cart.cafes.find(group => group.cafeId === cafeId);
        if (!cafeGroup || cafeGroup.items.length === 0) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, `No cart items for cafe ${cafeId}`);
        }

        const orderItems = cafeGroup.items.map(cartItemToOrderItem);
        // By constructing the session with order items, we get order totals 'for free'
        const session = await getOrCreatePrewarmedSession(userId, cafeId, orderItems);
        const waitTime = await session.retrieveWaitTime();

        return {
            waitTime,
            subtotal: session.orderTotalWithoutTax,
            tax:      session.orderTotalTax,
            total:    session.orderTotalWithTax,
        };
    }

    /**
     * Fire-and-forget prewarm for all cafes in the user's cart.
     * Called after cart mutations so payment sessions are ready ahead of time.
     */
    static prewarmFromCart(userId: string, cafes: Array<{ cafeId: string; items: ICartItemRecord[] }>): void {
        for (const cafeGroup of cafes) {
            if (cafeGroup.items.length === 0) {
                continue;
            }
            const orderItems = cafeGroup.items.map(cartItemToOrderItem);
            getOrCreatePrewarmedSession(userId, cafeGroup.cafeId, orderItems)
                .catch(err => orderLog.error(`Prewarm failed for ${userId}:${cafeGroup.cafeId}:`, err));
        }
    }

    static async keepalivePrewarm(userId: string): Promise<number> {
        return keepalivePrewarm(userId);
    }
}
