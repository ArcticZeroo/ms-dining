import { BuyOnDemandClient, JSON_HEADERS } from '../../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { IPaymentCardInfo } from '@msdining/common/models/cart';

interface ILogIframeDataParams {
    client: BuyOnDemandClient;
    paymentToken: string;
    cardInfo: IPaymentCardInfo;
    orderId: string;
    orderNumber: string;
}

export const logIframeData = ({ client, paymentToken, cardInfo, orderId, orderNumber }: ILogIframeDataParams) => {
    return client.requestAsync(
        `/order/logIframeData`,
        {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify({
                type:        'success',
                data:        {
                    token:    paymentToken,
                    cardInfo: {
                        cardIssuer:          cardInfo.cardIssuer,
                        accountNumberMasked: cardInfo.accountNumberMasked,
                        expirationYearMonth: cardInfo.expirationYearMonth,
                        cardholderName:      cardInfo.cardHolderName,
                        postalCode:          cardInfo.postalCode,
                    }
                },
                orderId:     orderId,
                orderNumber: orderNumber,
                paymentType: 'rGuestIframe'
            })
        },
        false /*shouldValidateSuccess*/
    );
}