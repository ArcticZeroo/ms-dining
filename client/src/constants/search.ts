import { SearchEntityType } from '@msdining/common/models/search';

interface IEntityDisplayData {
    className: string;
    iconName: string;
}

export const entityDisplayDataByType: Record<SearchEntityType, IEntityDisplayData> = {
    [SearchEntityType.menuItem]: {
        className: 'entity-menu-item',
        iconName:  'lunch_dining'
    },
    [SearchEntityType.station]:  {
        className: 'entity-station',
        iconName:  'restaurant'
    },
    [SearchEntityType.cafe]:     {
        className: 'entity-cafe',
        iconName:  'store'
    }
};
