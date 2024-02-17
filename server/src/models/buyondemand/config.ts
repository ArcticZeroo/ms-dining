export interface ISiteDataResponseItem {
    storePriceLevel: string;
    displayOptions: {
        onDemandTerminalId: string;
        onDemandEmployeeId: string;
        'profit-center-id': string;
    };
    siteStoreInfo: {
        storeInfoId: string
    }
}