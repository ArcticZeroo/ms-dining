import { IOrderingContext } from '../../../../../shared/models/cart.js';
import { BuyOnDemandClient, JSON_HEADERS } from '../../../../../shared/buy-ondemand/buy-ondemand-client.js';
import z from 'zod';
import { IPayConfig, ISiteData, PayConfigSchema, SiteDataItemSchema } from '../../../../models/ordering.js';
import { buildStoreInfo } from '../../../util/order.js';

const retrieveSiteData = async (client: BuyOnDemandClient): Promise<ISiteData> => {
    // Tenant ID is the canonical path slot here, mirroring the official BoD
    // UI request. ContextId also works on the server today but is not
    // guaranteed to remain valid.
    const response = await client.requestAsync(`/sites/${client.config.tenantId}`, {
        method:  'GET',
        headers: JSON_HEADERS
    });

    const json = await response.json();

    const siteDataArray = z.array(SiteDataItemSchema).parse(json);
    if (siteDataArray.length===0) {
        throw new Error(`No site data found for tenant ${client.config.tenantId}`);
    }

    return siteDataArray[0]!;
}

const retrievePayConfig = async (client: BuyOnDemandClient): Promise<IPayConfig> => {
    // BoD UI sends the full storeInfo block from /config here and does
    // NOT send a scheduleTime. The server appears to use storeInfo.timezone
    // to scope schedule resolution; missing it (or a hardcoded scheduleTime
    // window) can cause subsequent /concepts and /orders calls to behave as
    // if the cafe is closed, returning CONCEPTS_NOT_AVAILABLE.
    const storeInfo = client.config.storeInfo;
    if (storeInfo==null) {
        throw new Error(`retrievePayConfig: storeInfo missing on client.config for ${client.cafe.id}.`);
    }

    const browserStoreInfo = buildStoreInfo(storeInfo);

    const response = await client.requestAsync(
        `/sites/${client.config.contextId}/${client.config.displayProfileId}`,
        {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify({
                storeInfo:         browserStoreInfo,
                scheduledDay:      0,
                isEasyMenuEnabled: false,
            })
        }
    );

    const json = await response.json();
    return PayConfigSchema.parse(json);
}

const retrieveProfitCenterName = async (client: BuyOnDemandClient, profitCenterId: string): Promise<string> => {
    const response = await client.requestAsync(`/sites/${client.config.tenantId}/${client.config.contextId}/profitCenter/${profitCenterId}`);
    return response.text();
}

export const requestDailyOrderingContextAsync = async (client: BuyOnDemandClient): Promise<IOrderingContext> => {
    const [siteData, payConfig] = await Promise.all([
        retrieveSiteData(client),
        retrievePayConfig(client)
    ]);

    const orderingContext: IOrderingContext = {
        onDemandTerminalId: siteData.displayOptions.onDemandTerminalId,
        onDemandEmployeeId: siteData.displayOptions.onDemandEmployeeId,
        profitCenterId:     siteData.displayOptions['profit-center-id'],
        storePriceLevel:    siteData.storePriceLevel,
        profitCenterName:   '',
        payClientId:        payConfig.pay.clientId,
        checkTypeId:        siteData.displayOptions['check-type'],
        fullSiteStoreInfo:  siteData.siteStoreInfo,
        fullPickupConfig:   siteData.pickUpConfig
    };

    orderingContext.profitCenterName = await retrieveProfitCenterName(client, orderingContext.profitCenterId);

    return orderingContext;
}
