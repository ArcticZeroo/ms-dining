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
}

export interface ICheapItemSearchResult {
    name: string;
    description?: string;
    imageUrl?: string;
    locationDatesByCafeId: Map<string, Array<Date>>;
    price: number;
}

export interface IServerSearchResult {
    type: 'menuItem' | 'station';
    name: string;
    description?: string;
    imageUrl?: string;
    locations: Record<string, Array<string>>;
    matchReasons: Array<'description' | 'title'>;
}

export interface IServerCheapItemSearchResult {
    name: string;
    description?: string;
    imageUrl?: string;
    locations: Record<string, Array<string>>;
    price: number;
}