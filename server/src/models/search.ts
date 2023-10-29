export enum SearchResultEntityType {
    MenuItem = 'cafe',
    Station = 'station',
}

export enum SearchResultMatchReason {
    Title = 'title',
    Description = 'description',
}

export interface ISearchResult {
    type: SearchResultEntityType;
    matchReasons: Set<SearchResultMatchReason>;
    matchingCafeIds: Set<string>;
    matchingDateStrings: Set<string>;
    imageUrl: string;
    name: string;
    description?: string;
}