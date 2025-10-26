import { DateUtil } from '@msdining/common';
import { SearchEntityType } from '@msdining/common/models/search';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { DiningClient } from '../api/dining.ts';
import { CafeView } from '../models/cafe.ts';
import { getParentView } from './view.ts';

export const getViewMenuUrlDirect = (view: CafeView) => `/menu/${view.value.id}`;

interface IGetViewUrlParams {
    view: CafeView;
    viewsById: Map<string, CafeView>;
    shouldUseGroups: boolean;
    cafeIdsOnPage?: Set<string>;
}

export const getViewMenuUrl = ({ view, viewsById, shouldUseGroups, cafeIdsOnPage }: IGetViewUrlParams) => {
    if (cafeIdsOnPage?.has(view.value.id)) {
        return `#${view.value.id}`;
    }

    const parentView = getParentView(viewsById, view, shouldUseGroups);
    return `${getViewMenuUrlDirect(parentView)}${parentView === view ? '' : `#${view.value.id}`}`;
}

export const idPrefixByEntityType: Record<SearchEntityType, string> = {
    [SearchEntityType.menuItem]: 'menu-item',
    [SearchEntityType.station]: 'station',
    [SearchEntityType.cafe]: 'cafe',
};

interface IScrollAnchorData {
    cafeId: string;
    entityType: SearchEntityType;
    name: string;
}

export const getSearchAnchorId = ({ cafeId, entityType, name }: IScrollAnchorData) => `${cafeId}-${idPrefixByEntityType[entityType]}-${normalizeNameForSearch(name)}`;

export const getSearchAnchorJumpUrlOnSamePage = (scrollAnchorData: IScrollAnchorData) => {
    const url = new URL(window.location.href);
    url.hash = getSearchAnchorId(scrollAnchorData);
    return url.href;
}

interface ISearchJumpData extends IScrollAnchorData {
    view: CafeView;
    date?: Date;
}

export const getSearchAnchorJumpUrlOnAnotherPage = ({ cafeId, entityType, name, view, date }: ISearchJumpData) => {
    const dateString = date && !DateUtil.isSameDate(date, DiningClient.getTodayDateForMenu())
        ? `?date=${DateUtil.toDateString(date)}`
        : '';

    const url = getViewMenuUrlDirect(view);

    return `${url}${dateString}#${getSearchAnchorId({ cafeId, entityType, name })}`;
};

interface IGetJumpUrlParams extends ISearchJumpData {
    cafeIdsOnPage: Set<string>;
}

export const getSearchAnchorJumpUrl = ({ cafeId, entityType, name, view, date, cafeIdsOnPage }: IGetJumpUrlParams) => {
    if (cafeIdsOnPage.has(cafeId)) {
        return getSearchAnchorJumpUrlOnSamePage({ cafeId, entityType, name });
    }

    return getSearchAnchorJumpUrlOnAnotherPage({ cafeId, entityType, name, view, date });
}