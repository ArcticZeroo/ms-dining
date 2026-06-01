import { ISiteData } from '../../worker/models/ordering.js';

export interface IOrderingContext {
    onDemandTerminalId: string;
    onDemandEmployeeId: string;
    profitCenterId: string;
    storePriceLevel: string;
    profitCenterName: string;
    payClientId: string;
    checkTypeId?: string;
    fullSiteStoreInfo: ISiteData['siteStoreInfo'];
    fullPickupConfig: ISiteData['pickUpConfig'];
}