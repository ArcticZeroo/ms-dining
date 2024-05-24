import { SearchEntityType } from '@msdining/common/dist/models/search';
import { CafeView, CafeViewType, ICafe } from '../models/cafe.ts';
import { ILocationCoordinates } from '@msdining/common/dist/models/util';
import { ApplicationSettings } from '../constants/settings.ts';

interface IGetCafeNameParams {
    cafe: ICafe,
    showGroupName: boolean;
    useShortNames?: boolean;
}

export const getCafeName = ({ cafe, showGroupName, useShortNames = false }: IGetCafeNameParams) => {
    const targetName = (useShortNames && cafe.shortName) || cafe.name;

    if (!showGroupName || !cafe.group || cafe.group.alwaysExpand) {
        return targetName;
    }

    const groupName = (useShortNames && cafe.group.shortName) || cafe.group.name;

    if (targetName === groupName) {
        return targetName;
    }

    return `${targetName} (${groupName})`;
};

interface IGetViewNameParams {
    view: CafeView;
    showGroupName: boolean;
    useShortNames?: boolean;
}

export const getViewName = ({ view, showGroupName, useShortNames = false }: IGetViewNameParams) => {
    if (view.type === CafeViewType.single) {
        return getCafeName({
            cafe: view.value,
            showGroupName,
            useShortNames
        });
    }

    return (useShortNames && view.value.shortName) || view.value.name;
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