import type { IWaitTimeResponse } from '@msdining/common/models/http';
import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type { PhoneValidResult } from 'phone';
import type { SubmitOrderStage } from '@msdining/common/models/cart';
import type { BuyOnDemandClient } from '../../../../shared/buy-ondemand/buy-ondemand-client.js';

/**
 * The subset of CafeOrderSession that the orchestrator depends on.
 */
export interface IOrderSession {
    readonly client: BuyOnDemandClient | { refreshLogin(): Promise<void> };
    readonly orderId: string | null;
    readonly orderNumber: string | null;
    readonly orderTotalWithoutTax: number;
    readonly orderTotalTax: number;
    readonly orderTotalWithTax: number;
    readonly lastCompletedStage: SubmitOrderStage | string;
    readonly cardProcessorToken: string;
    readonly rawCartItemsForWaitTime: readonly unknown[];
    readonly createdDateString: string;
    readonly isReadyForPayment: boolean;

    populateCart(): Promise<void>;
    prepareForIframe(iframeCssUrl: string): Promise<unknown>;
    getCardProcessorUrl(iframeCssUrl?: string): string;
    completeOrderAfterIframePayment(params: {
        alias: string;
        phoneData: PhoneValidResult;
        paymentToken: string;
        cardInfo: IPaymentCardInfo;
    }): Promise<IWaitTimeResponse>;
}
