export enum SearchResultEntityType {
    MenuItem = 'menuItem',
    Station = 'station',
}

export enum SearchResultMatchReason {
    Title = 'title',
    Description = 'description',
}

export interface ISearchResult {
    type: SearchResultEntityType;
    matchReasons: Set<SearchResultMatchReason>;
    locationDatesByCafeId: Map<string, Set<string>>;
    imageUrl: string;
    name: string;
    description?: string;
}