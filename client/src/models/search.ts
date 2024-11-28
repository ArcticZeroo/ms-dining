import { SearchTypes } from '@msdining/common';
import { SearchMatchReason } from '@msdining/common/dist/models/search';

export enum SearchResultsViewMode {
    horizontalScroll,
    horizontalWrap,
    vertical
}

export const allSearchEntityTypes = [
    SearchTypes.SearchEntityType.menuItem,
    SearchTypes.SearchEntityType.station,
];

export enum SearchEntityFilterType {
    all,
    menuItem,
    station
}

export interface IQuerySearchResult {
    entityType: SearchTypes.SearchEntityType;
    name: string;
    description?: string;
    imageUrl?: string;
    locationDatesByCafeId: Map<string, Array<Date>>;
    priceByCafeId: Map<string, number>;
    stationByCafeId: Map<string, string>;
    matchReasons: Set<SearchMatchReason>;
    tags?: Set<string>;
    searchTags?: Set<string>;
    matchedModifiers: Map<string, Set<string>>;
}

export interface ICheapItemSearchResult {
    name: string;
    description?: string;
    imageUrl?: string;
    locationDatesByCafeId: Map<string, Array<Date>>;
    price: number;
    minCalories: number;
    maxCalories: number;
}

export interface IServerCheapItemSearchResult {
    name: string;
    description?: string;
    imageUrl?: string;
    locations: Record<string, Array<string>>;
    price: number;
    minCalories: number;
    maxCalories: number;
}