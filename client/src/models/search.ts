export enum SearchEntityType {
    menuItem,
    station,
}

export enum SearchMatchReason {
    title,
    description
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

export interface ISearchResult {
    entityType: SearchEntityType;
    name: string;
    description?: string;
    imageUrl?: string;
    cafeIds: Set<string>;
    dateStrings: Set<string>;
    matchReasons: Set<SearchMatchReason>;
}

export type SearchResultsMap = Map<SearchEntityType, Map<string, ISearchResult>>;

export interface IServerSearchResult {
    type: 'menuItem' | 'station';
    name: string;
    description?: string;
    imageUrl?: string;
    matchingCafeIds: string[];
    matchingDateStrings: string[];
    matchReasons: Array<'description' | 'title'>;
}