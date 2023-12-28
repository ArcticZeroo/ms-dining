import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { CafeView } from '../models/cafe.ts';

export const getViewMenuUrl = (view: CafeView) => `/menu/${view.value.id}`;


interface ISearchJumpData {
    view: CafeView;
    entityType: SearchEntityType;
    name: string;
}

export const idPrefixByEntityType: Record<SearchEntityType, string> = {
    [SearchEntityType.menuItem]: 'menu-item',
    [SearchEntityType.station]: 'station',
};

export const getViewMenuUrlWithJump = ({ entityType, name, view }: ISearchJumpData) => {
    const targetAnchor = `${idPrefixByEntityType[entityType]}-${normalizeNameForSearch(name)}`;
    return `${getViewMenuUrl(view)}#${targetAnchor}`;
};