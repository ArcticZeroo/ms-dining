import { SearchEntityType } from '@msdining/common/dist/models/search';
import { CafeView, CafeViewType, ICafe } from '../models/cafe.ts';
import { ILocationCoordinates } from '@msdining/common/dist/models/util';
import { ApplicationSettings } from '../constants/settings.ts';

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

export const getViewName = (view: CafeView, showGroupName: boolean) => {
    if (view.type === CafeViewType.single) {
        return getCafeName(view.value, showGroupName);
    }

    return view.value.name;
}

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

export const getViewLocation = (view: CafeView): ILocationCoordinates => {
    if (view.type === CafeViewType.single) {
        return getCafeLocation(view.value);
    }

    if (view.value.location) {
        return view.value.location;
    }

    let totalLat = 0;
    let totalLong = 0;
    for (const member of view.value.members) {
        const { lat, long } = getCafeLocation(member);
        totalLat += lat;
        totalLong += long;
    }

    return {
        lat:  totalLat / view.value.members.length,
        long: totalLong / view.value.members.length
    }
}