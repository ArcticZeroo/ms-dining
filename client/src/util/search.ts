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
}

