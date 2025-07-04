export enum SearchEntityType {
    menuItem = 'menuItem',
    station = 'station',
    cafe = 'cafe',
}

export const SEARCH_ENTITY_TYPE_NAME_TO_ENUM: { [K in SearchEntityType]: K } = {
    menuItem: SearchEntityType.menuItem,
    station:  SearchEntityType.station,
    cafe:     SearchEntityType.cafe
};

export const SEARCH_ENTITY_TYPE_TO_DB_ID: { [T in SearchEntityType]: number } = {
    [SearchEntityType.menuItem]: 0,
    [SearchEntityType.station]:  1,
    [SearchEntityType.cafe]:     2
};

export const DB_ID_TO_SEARCH_ENTITY_TYPE: { [P in keyof typeof SEARCH_ENTITY_TYPE_TO_DB_ID as typeof SEARCH_ENTITY_TYPE_TO_DB_ID[P]]: P } = {
    0: SearchEntityType.menuItem,
    1: SearchEntityType.station,
    2: SearchEntityType.cafe
};

export enum SearchMatchReason {
    title = 'title',
    description = 'description',
    // AI-generated tags like "breakfast"
    searchTags = 'searchTags',
    // Tags like "vegan"
    tags = 'tags',
    // Modifiers like "Decaf" on a latte
    modifier = 'modifier'
}

export const allSearchEntityTypes = [
    SearchEntityType.menuItem,
    SearchEntityType.station,
    SearchEntityType.cafe,
];

export enum SearchEntityFilterType {
    all,
    menuItem,
    station,
    cafe
}

export interface ISearchResult {
    entityType: SearchEntityType;
    name: string;
    description?: string;
    imageUrl?: string;
    locationDatesByCafeId: Map<string, Array<Date>>;
    priceByCafeId: Map<string, number>;
    stationByCafeId: Map<string, string>;
    matchReasons: Set<SearchMatchReason>;
    searchTags?: Set<string>;
    tags?: Set<string>;
    matchedModifiers: Map<string, Set<string>>;
    vectorDistance?: number;
}

export interface ISearchQuery {
    text: string;
    type?: SearchEntityType;
}
