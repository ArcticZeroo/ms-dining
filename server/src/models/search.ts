import { SearchTypes } from '@msdining/common';
import { Nullable } from './util.js';

export interface ISearchResult {
    type: SearchTypes.SearchEntityType;
    matchReasons: Set<SearchTypes.SearchMatchReason>;
    locationDatesByCafeId: Map<string, Set<string>>;
    imageUrl?: Nullable<string>;
    name: string;
    description?: Nullable<string>;
    prices: Set<number>;
    searchTags?: Set<string>;
}

export interface ICheapItemSearchResult {
    locationDatesByCafeId: Map<string, Set<string>>;
    imageUrl?: Nullable<string>;
    name: string;
    description?: Nullable<string>;
    price: number;
    minCalories: number;
    maxCalories: number;
}