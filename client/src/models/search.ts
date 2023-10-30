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

interface ISearchResultLocation {
    cafeId: string;
    date: Date;
}

export interface ISearchResult {
    entityType: SearchEntityType;
    name: string;
    description?: string;
    imageUrl?: string;
    locations: ISearchResultLocation[];
    matchReasons: Set<SearchMatchReason>;
}


interface IServerSearchResultLocation {
    cafeId: string;
    date: string;
}

export interface IServerSearchResult {
    type: 'menuItem' | 'station';
    name: string;
    description?: string;
    imageUrl?: string;
    locations: IServerSearchResultLocation[];
    matchReasons: Array<'description' | 'title'>;
}