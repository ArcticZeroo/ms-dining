import { DateUtil } from '@msdining/common';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { DiningClient } from '../api/dining.ts';
import { CafeView } from '../models/cafe.ts';

export const getViewMenuUrl = (view: CafeView) => `/menu/${view.value.id}`;

export const idPrefixByEntityType: Record<SearchEntityType, string> = {
    [SearchEntityType.menuItem]: 'menu-item',
    [SearchEntityType.station]: 'station',
};

interface IScrollAnchorData {
    cafeId: string;
    entityType: SearchEntityType;
    name: string;
}

export const getScrollAnchorId = ({ cafeId, entityType, name }: IScrollAnchorData) => `${cafeId}-${idPrefixByEntityType[entityType]}-${normalizeNameForSearch(name)}`;

export const getJumpUrlOnSamePage = (scrollAnchorData: IScrollAnchorData) => {
    const url = new URL(window.location.href);
    url.hash = getScrollAnchorId(scrollAnchorData);
    return url.href;
}

interface ISearchJumpData extends IScrollAnchorData {
    view: CafeView;
    date?: Date;
}

export const getViewMenuUrlWithJump = ({ cafeId, entityType, name, view, date }: ISearchJumpData) => {
    const dateString = date && !DateUtil.isSameDate(date, DiningClient.getTodayDateForMenu())
        ? `?date=${DateUtil.toDateString(date)}`
        : '';
    return `${getViewMenuUrl(view)}${dateString}#${getScrollAnchorId({ cafeId, entityType, name })}`;
};