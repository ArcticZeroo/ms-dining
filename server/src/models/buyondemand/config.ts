export interface ISiteDataResponseItem {
    storePriceLevel: string;
    displayOptions: {
        onDemandTerminalId: string;
        onDemandEmployeeId: string;
        'profit-center-id': string;
        'check-type'?: string;
    };
    siteStoreInfo: {
        storeInfoId: string
    }
}