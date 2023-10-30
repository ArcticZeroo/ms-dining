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
    locationDatesByCafeId: Map<string, Array<Date>>;
    matchReasons: Set<SearchMatchReason>;
}

export interface IServerSearchResult {
    type: 'menuItem' | 'station';
    name: string;
    description?: string;
    imageUrl?: string;
    locations: Record<string, Array<string>>;
    matchReasons: Array<'description' | 'title'>;
}