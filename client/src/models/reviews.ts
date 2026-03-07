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

export const isStationReview = (lookup: IReviewLookup): lookup is IReviewLookupForStation => lookup.stationId != null;

export const getReviewEntityId = (lookup: IReviewLookup): string => lookup.menuItemId ?? lookup.stationId;

export const getReviewEntityName = (lookup: IReviewLookup): string => lookup.menuItemName ?? lookup.stationName;