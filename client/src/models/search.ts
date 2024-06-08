import { SearchTypes } from '@msdining/common';

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
    pricesByCafeId: Map<string, number>;
    matchReasons: Set<SearchMatchReason>;
    tags?: Set<string>;
    searchTags?: Set<string>;
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

export interface IServerSearchResult {
    type: 'menuItem' | 'station';
    name: string;
    description?: string;
    imageUrl?: string;
    locations: Record<string, Array<string>>;
    prices: Record<string, number>;
    matchReasons: Array<SearchMatchReason>;
    tags?: Array<string>;
    searchTags?: Array<string>;
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