import { SearchTypes } from '@msdining/common';

export interface ISearchResult {
    type: SearchTypes.SearchEntityType;
    matchReasons: Set<SearchTypes.SearchMatchReason>;
    locationDatesByCafeId: Map<string, Set<string>>;
    imageUrl: string;
    name: string;
    description?: string;
}

export interface ICheapItemSearchResult {
    locationDatesByCafeId: Map<string, Set<string>>;
    imageUrl: string;
    name: string;
    description?: string;
    price: number;
    minCalories: number;
    maxCalories: number;
}