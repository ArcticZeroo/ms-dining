export enum SearchEntityType {
    menuItem = 'menuItem',
    station = 'station',
}

export enum SearchMatchReason {
    title = 'title',
    description = 'description',
    // AI-generated tags like "breakfast"
    searchTags = 'searchTags',
    // Tags like "vegan"
    tags = 'tags'
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
    priceByCafeId: Map<string, number>;
    stationsByCafeId: Map<string, string>;
    matchReasons: Set<SearchMatchReason>;
    searchTags?: Set<string>;
    tags?: Set<string>;
}

export interface ISearchQuery {
    text: string;
    type?: SearchEntityType;
}
