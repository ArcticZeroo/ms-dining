import React, { Dispatch, SetStateAction, useContext } from 'react';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { CafeView } from '../models/cafe.ts';
import { IQuerySearchResult, MapSearchSortType, SearchEntityFilterType } from '../models/search.ts';

export const MapSelectedViewContext = React.createContext<CafeView | null>(null);

export interface IMapSearchContext {
    query: string;
    allResults: IQuerySearchResult[];
    entityFilteredResults: IQuerySearchResult[];
    searchResultCafeIds: Set<string>;
    entityFilter: SearchEntityFilterType;
    setEntityFilter: Dispatch<SetStateAction<SearchEntityFilterType>>;
    sortType: MapSearchSortType;
    setSortType: (type: MapSearchSortType) => void;
    hasUserLocation: boolean;
    hasHomeCafes: boolean;
    stage: PromiseStage;

    retry(): void;
}

export const MapSearchContext = React.createContext<IMapSearchContext>({
    query:                 '',
    allResults:            [],
    entityFilteredResults: [],
    searchResultCafeIds:   new Set(),
    entityFilter:          SearchEntityFilterType.all,
    sortType:              MapSearchSortType.relevance,
    hasUserLocation:       false,
    hasHomeCafes:          false,
    stage:                 PromiseStage.notRun,
    setEntityFilter:       () => {},
    setSortType:           () => {},
    retry:                 () => {},
});

export const useMapSearchContext = () => useContext(MapSearchContext);


export interface IMapHighlightContext {
    selectedSearchResult: IQuerySearchResult | null;
    setSelectedSearchResult: Dispatch<SetStateAction<IQuerySearchResult | null>>;
    setHighlightedCafeIds: Dispatch<SetStateAction<Set<string>>>;
    effectiveHighlightedCafeIds: Set<string>;

    onCloseDetail(): void;
}

export const MapHighlightContext = React.createContext<IMapHighlightContext>({
    selectedSearchResult:        null,
    setSelectedSearchResult:     () => {
    },
    setHighlightedCafeIds:       () => {
    },
    effectiveHighlightedCafeIds: new Set(),
    onCloseDetail:               () => {
    },
});

export const useMapHighlightContext = () => useContext(MapHighlightContext);