export interface ISearchResult {
    stableId: number;
    imageUrl?: string;
    cafeIds: string[];
}

export type SearchResultsByItemName = Map<string, ISearchResult>;