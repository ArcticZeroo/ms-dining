import { SearchEntityFilterType, SearchEntityType } from '../models/search.ts';

export const matchesEntityFilter = (filter: SearchEntityFilterType, entryType: SearchEntityType) => {
    switch (filter) {
        case SearchEntityFilterType.all:
            return true;
        case SearchEntityFilterType.menuItem:
            return entryType === SearchEntityType.menuItem;
        case SearchEntityFilterType.station:
            return entryType === SearchEntityType.station;
        default:
            console.error('Unknown filter type', filter);
            return false;
    }
};

export const getSearchTabCount = (type: SearchEntityFilterType, tabCounts: Map<SearchEntityType, number>, totalResultCount: number) => {
    if (type === SearchEntityFilterType.all) {
        return totalResultCount;
    }

    if (type === SearchEntityFilterType.menuItem) {
        return tabCounts.get(SearchEntityType.menuItem) ?? 0;
    }

    if (type === SearchEntityFilterType.station) {
        return tabCounts.get(SearchEntityType.station) ?? 0;
    }

    return 0;
}