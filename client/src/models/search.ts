import { IDiningHall } from './dining-halls.ts';

export interface ISearchResult {
    stableId: number;
    diningHalls: IDiningHall[];
}

export type SearchResultsByItemName = Map<string, ISearchResult>;