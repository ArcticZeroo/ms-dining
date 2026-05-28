import { SERVICE_ERROR_CODES, ServiceError } from '../../rpc/errors.js';
import type { IOrderSession } from '../cafe/session/order-session.js';
import type { BuyOnDemandClient } from '../cafe/buy-ondemand/buy-ondemand-client.js';
import { fetchWaitTimeWithCartItems } from '../cafe/buy-ondemand/wait-time.js';
import { OrderStorageClient } from '../storage/clients/order/order.js';
import { getNamespaceLogger } from '../../../shared/util/log.js';
import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import { SubmitOrderStage } from '@msdining/common/models/cart';
import type {
    ICafeOrderDTO,
    ICompleteOrderResultDTO,
    IOrderItem,
    IPreparePaymentResult,
} from '@msdining/common/models/order';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import { phone } from 'phone';
import { isFakeOrderingEnabled } from '../../../shared/constants/env.js';
import { completeOrder, getPaymentSession, ORDER_SESSION_TTL_MS } from './order-session-manager.js';
import type { ISynthesisFlags } from '../../../shared/services/order.js';
import { trackDbPersistFailed, trackPostCloseRecovery, trackPreKitchenFailure } from './order-telemetry.js';

const orderLog = getNamespaceLogger('Order');

if (isFakeOrderingEnabled) {
    orderLog.info('⚠️  FAKE_ORDERING is enabled — no real charges will be made');
}

const getWaitTimeForSession = async (session: IOrderSession): Promise<IWaitTimeResponse> => {
    if (isFakeOrderingEnabled) {
        return { minTime: 5, maxTime: 10 };
    }

    return fetchWaitTimeWithCartItems(
		session.client as BuyOnDemandClient,
		[...session.rawCartItemsForWaitTime],
    );
};

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
    session.lastCompletedStage === SubmitOrderStage.closeOrder
	|| session.lastCompletedStage === SubmitOrderStage.sendTextReceipt
	|| session.lastCompletedStage === SubmitOrderStage.complete;

export abstract class OrderOrchestrator {
    static async preparePayment(
        userId: string,
        cafeId: string,
        items: IOrderItem[],
        iframeCssUrl: string,
        synthesisFlags?: ISynthesisFlags,
    ): Promise<IPreparePaymentResult> {
        const [pendingOrderId, session] = await getPaymentSession({
            userId,
            cafeId,
            items,
            iframeCssUrl,
            synthesisFlags,
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
                waitTime = await session.completeOrderAfterIframePayment({
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
                waitTime = await getWaitTimeForSession(session).catch(waitErr => {
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
}
