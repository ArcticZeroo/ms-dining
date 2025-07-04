import { DateUtil, SearchTypes } from '@msdining/common';
import { NavigateFunction } from 'react-router-dom';
import { SearchEntityFilterType } from '../models/search.ts';
import { getSearchUrl } from './url.ts';

export const matchesEntityFilter = (filter: SearchEntityFilterType, entryType: SearchTypes.SearchEntityType) => {
    switch (filter) {
    case SearchEntityFilterType.all:
        return true;
    case SearchEntityFilterType.menuItem:
        return entryType === SearchTypes.SearchEntityType.menuItem;
    case SearchEntityFilterType.station:
        return entryType === SearchTypes.SearchEntityType.station;
    case SearchEntityFilterType.cafe:
        return entryType === SearchTypes.SearchEntityType.cafe;
    default:
        console.error('Unknown filter type', filter);
        return false;
    }
};

export const getSearchTabCount = (type: SearchEntityFilterType, tabCounts: Map<SearchTypes.SearchEntityType, number>, totalResultCount: number) => {
    if (type === SearchEntityFilterType.all) {
        return totalResultCount;
    }

    if (type === SearchEntityFilterType.menuItem) {
        return tabCounts.get(SearchTypes.SearchEntityType.menuItem) ?? 0;
    }

    if (type === SearchEntityFilterType.station) {
        return tabCounts.get(SearchTypes.SearchEntityType.station) ?? 0;
    }

    if (type === SearchEntityFilterType.cafe) {
        return tabCounts.get(SearchTypes.SearchEntityType.cafe) ?? 0;
    }

    return 0;
}

export const navigateToSearch = (navigate: NavigateFunction, searchText: string) => {
    navigate(getSearchUrl(searchText));
}

export const isAnyDateToday = (locationEntriesByCafeId: Map<string, Date[]>, today: Date = new Date()) => {
    for (const dates of locationEntriesByCafeId.values()) {
        for (const date of dates) {
            if (DateUtil.isSameDate(today, date)) {
                return true;
            }
        }
    }

    return false;
}

export const isSearchResultVisible = (locationEntriesByCafeId: Map<string, Date[]>, allowFutureMenus: boolean, selectedDate: Date) => {
    return allowFutureMenus || isAnyDateToday(locationEntriesByCafeId, selectedDate);
}