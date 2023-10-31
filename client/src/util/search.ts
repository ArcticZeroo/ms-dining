import { SearchEntityFilterType, SearchEntityType } from '../models/search.ts';

// Basic fuzzy search via https://stackoverflow.com/a/15252131
export const fuzzySearch = (source: string, search: string) => {
    const hay = source.toLowerCase();
    let i = 0;
    let n = -1;
    let l;
    search = search.toLowerCase();
    for (; l = search[i++];) {
        if (!~(n = hay.indexOf(l, n + 1))) {
            return false;
        }
    }
    return true;
};

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
}

