export enum SearchEntityType {
    menuItem,
    station,
}

export const allSearchEntityTypes = [
    SearchEntityType.menuItem,
    SearchEntityType.station,
];

export enum SearchEntityFilterType {
    all,
    menuItem,
    station
}

export interface ISearchMatch {
    entityType: SearchEntityType;
    name: string;
    imageUrl?: string;
}

export interface ISearchResult extends ISearchMatch {
    stableId: number;
    cafeIds: Set<string>;
}

export type SearchResultsMap = Map<SearchEntityType, Map<string, ISearchResult>>;