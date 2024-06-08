import { SearchTypes } from '@msdining/common';
import { Nullable } from './util.js';

// Needs to be separate from ISearchResult since we use a set of dateStrings instead of an array of dates.
export interface IServerSearchResult {
    type: SearchTypes.SearchEntityType;
    matchReasons: Set<SearchTypes.SearchMatchReason>;
    locationDatesByCafeId: Map<string, Set<string>>;
    priceByCafeId: Map<string, number>;
    stationByCafeId: Map<string, string>;
    imageUrl?: Nullable<string>;
    name: string;
    description?: Nullable<string>;
    tags?: Set<string>;
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