import type { IWaitTimeResponse } from '@msdining/common/models/http';
import type { ICartItemRecord, IPaymentCardInfo } from '@msdining/common/models/cart';
import type { PhoneValidResult } from 'phone';
import type { SubmitOrderStage } from '@msdining/common/models/cart';
import type { BuyOnDemandClient } from '../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { IOrderItem } from '@msdining/common/models/order';

interface IFakeBuyOnDemandClient {
    cafe: {
        id: string;
    };
    refreshLogin(): Promise<void>;
}

/**
 * The subset of CafeOrderSession that the orchestrator depends on.
 */
export interface IOrderSession {
    readonly client: BuyOnDemandClient | IFakeBuyOnDemandClient;
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
    readonly itemsHash: string;

    isUsableForPaymentWithItems(items: Array<IOrderItem> | Array<ICartItemRecord> | string /*hash*/): boolean;
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
