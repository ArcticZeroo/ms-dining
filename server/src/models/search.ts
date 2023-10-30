export enum SearchResultEntityType {
    MenuItem = 'menuItem',
    Station = 'station',
}

export enum SearchResultMatchReason {
    Title = 'title',
    Description = 'description',
}

interface ISearchResultLocation {
    cafeId: string;
    date: string;
}

export interface ISearchResult {
    type: SearchResultEntityType;
    matchReasons: Set<SearchResultMatchReason>;
    locations: ISearchResultLocation[];
    imageUrl: string;
    name: string;
    description?: string;
}