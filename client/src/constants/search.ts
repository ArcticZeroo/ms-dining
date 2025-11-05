import { SearchEntityType } from '@msdining/common/models/search';

interface IEntityDisplayData {
    className: string;
    iconName: string;
    displayName: string;
}

export const entityDisplayDataByType: Record<SearchEntityType, IEntityDisplayData> = {
    [SearchEntityType.menuItem]: {
        className: 'entity-menu-item',
        iconName:  'lunch_dining',
        displayName: 'Menu Item',
    },
    [SearchEntityType.station]:  {
        className: 'entity-station',
        iconName:  'restaurant',
        displayName: 'Station',
    },
    [SearchEntityType.cafe]:     {
        className: 'entity-cafe',
        iconName:  'store',
        displayName: 'Cafe',
    }
};
