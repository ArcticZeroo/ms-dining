import { toLocalIsoOffset } from '../../../util/order.js';
import { BuyOnDemandClient, JSON_HEADERS } from '../../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { fixed } from '../../../../../shared/util/math.js';
import { IOrderTotalPrice } from '../../../../models/ordering.js';
import { IOrderingContext } from '../../../../../shared/models/cart.js';
import { IBuyOnDemandOrderDetails } from '../../../../models/buy-ondemand.js';
import { z } from 'zod';

interface IRetrieveIframeTokenParams {
    price: IOrderTotalPrice;
    client: BuyOnDemandClient;
    orderingContext: IOrderingContext;
    firstStationId: string | undefined;
    orderNumber: string;
    iframeCssUrl?: string;
    lastOrderDetails: IBuyOnDemandOrderDetails | null;
}

export const retrieveIframeToken = async ({ price, client, orderingContext, firstStationId, orderNumber, iframeCssUrl, lastOrderDetails }: IRetrieveIframeTokenParams): Promise<string> => {
    const billDate = lastOrderDetails?.created ?? toLocalIsoOffset(new Date());
    const nowString = toLocalIsoOffset(new Date());

    const response = await client.requestAsync(`/iFrame/token/${client.config.tenantId}`,
        {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify({
                taxAmount:             price.tax.toFixed(2),
                invoiceId:             orderNumber,
                billDate,
                userCurrentDate:       nowString,
                currencyUnit:          'USD',
                description:           `Order ${orderNumber}`,
                transactionAmount:     price.total.toFixed(2),
                remainingTipAmount:    '0.00',
                tipAmount:             '0.00',
                style:                 iframeCssUrl ?? `https://${client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${client.cafe.id}.buy-ondemand.com/false/false/false`,
                multiPaymentAmount:    fixed(price.total, 2),
                isWindCave:            false,
                isCyberSource:         false,
                isCyberSourceWallets:  false,
                language:              'en',
                previousTransactionId: null,
                contextId:             client.config.contextId,
                profileId:             client.config.displayProfileId,
                // Not sure if the specific conceptId matters here, picking the first one seems to work though
                conceptId:             firstStationId,
                profitCenterId:        orderingContext.profitCenterId,
                processButtonText:     'PROCESS',
                terminalId:            orderingContext.onDemandTerminalId
            })
        });

    const json = await response.json();
    const { token } = z.object({ token: z.string() }).parse(json);

    return token;
}