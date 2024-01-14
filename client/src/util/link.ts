import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { CafeView } from '../models/cafe.ts';
import { DateUtil } from '@msdining/common';
import { DiningClient } from '../api/dining.ts';

export const getViewMenuUrl = (view: CafeView) => `/menu/${view.value.id}`;

export const idPrefixByEntityType: Record<SearchEntityType, string> = {
    [SearchEntityType.menuItem]: 'menu-item',
    [SearchEntityType.station]: 'station',
};

interface ISearchJumpData {
    view: CafeView;
    entityType: SearchEntityType;
    name: string;
    date?: Date;
}

export const getViewMenuUrlWithJump = ({ entityType, name, view, date }: ISearchJumpData) => {
    const targetAnchor = `${idPrefixByEntityType[entityType]}-${normalizeNameForSearch(name)}`;
    const dateString = date && !DateUtil.isSameDate(date, DiningClient.getTodayDateForMenu())
        ? `?date=${DateUtil.toDateString(date)}`
        : '';
    return `${getViewMenuUrl(view)}${dateString}#${targetAnchor}`;
};