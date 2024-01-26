import { SearchEntityType } from '@msdining/common/dist/models/search';
import { ApplicationSettings } from '../api/settings.ts';
import { ICafe } from '../models/cafe.ts';
import { ILocationCoordinates } from '@msdining/common/dist/models/util';

export const getCafeName = (cafe: ICafe, showGroupName: boolean) => {
    if (!showGroupName || !cafe.group || cafe.group.alwaysExpand) {
        return cafe.name;
    }

    const groupName = cafe.group.name;

    if (cafe.name === groupName) {
        return cafe.name;
    }

    return `${cafe.name} (${groupName})`;
};

export const getTargetSettingForFavorite = (type: SearchEntityType) => type === SearchEntityType.menuItem
																	   ? ApplicationSettings.favoriteItemNames
																	   : ApplicationSettings.favoriteStationNames;

export const getCafeLocation = (cafe: ICafe): ILocationCoordinates => {
    const location = cafe.location ?? cafe.group?.location;

    if (!location) {
        throw new Error('Cafe has no location!');
    }

    return location;
}