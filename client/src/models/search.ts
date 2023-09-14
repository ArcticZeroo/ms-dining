export interface ISearchResult {
    stableId: number;
    diningHallIds: string[];
}

export type SearchResultsByItemName = Map<string, ISearchResult>;