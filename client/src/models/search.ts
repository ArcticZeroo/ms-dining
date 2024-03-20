import { SearchTypes } from '@msdining/common';

export enum SearchMatchReason {
    title,
    description
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
    matchReasons: Set<SearchMatchReason>;
    prices: Set<number>;
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
    matchReasons: Array<SearchMatchReason>;
    prices: Array<number>;
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