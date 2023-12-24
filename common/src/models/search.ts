export enum SearchEntityType {
    menuItem = 'menuItem',
    station = 'station',
}

export enum SearchMatchReason {
    title = 'title',
    description = 'description'
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
    locationDatesByCafeId: Map<string, Array<Date>>;
    matchReasons: Set<SearchMatchReason>;
}

export interface ISearchQuery {
    text: string;
    type?: SearchEntityType;
}
