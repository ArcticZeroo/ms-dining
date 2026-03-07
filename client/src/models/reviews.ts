interface IReviewLookupForStation {
    stationId: string;
    stationName: string;
    menuItemId?: undefined;
    menuItemName?: undefined;
}

interface IReviewLookupForMenuItem {
    menuItemId: string;
    menuItemName: string;
    stationId?: undefined;
    stationName?: undefined;
}

export type IReviewLookup = IReviewLookupForStation | IReviewLookupForMenuItem;