export interface ISearchResult {
    stableId: number;
    imageUrl?: string;
    diningHallIds: string[];
}

export type SearchResultsByItemName = Map<string, ISearchResult>;