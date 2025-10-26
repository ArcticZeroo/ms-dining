import { SearchEntityType } from '@msdining/common/models/search';
import { ILocationCoordinates } from '@msdining/common/models/util';
import { fromDateString, isDateBefore } from '@msdining/common/util/date-util';
import { ApplicationSettings } from '../constants/settings.ts';
import { CafeView, CafeViewType, ICafe } from '../models/cafe.ts';
import { stringWithSpaceIfExists } from './string.ts';

interface IGetNameParams {
    showGroupName: boolean;
    useShortNames?: boolean;
    includeEmoji?: boolean;
}

interface IGetCafeNameParams extends IGetNameParams {
    cafe: ICafe;
}

interface IGetViewNameParams extends IGetNameParams {
    view: CafeView;
}

export const getCafeName = ({ cafe, showGroupName, useShortNames = false, includeEmoji = true }: IGetCafeNameParams) => {
    const targetNameBase = (useShortNames && cafe.shortName) || cafe.name;
    const targetNameWithEmoji = `${targetNameBase}${stringWithSpaceIfExists(includeEmoji && cafe.emoji)}`;

    if (!showGroupName || !cafe.group || cafe.group.alwaysExpand) {
        return targetNameWithEmoji;
    }

    const groupName = (useShortNames && cafe.group.shortName) || cafe.group.name;

    if (targetNameBase === groupName || targetNameWithEmoji === groupName) {
        return targetNameWithEmoji;
    }

    return `${targetNameWithEmoji} @ ${groupName}`;
};

export const getViewName = ({ view, showGroupName, useShortNames = false, includeEmoji = true }: IGetViewNameParams) => {
    if (view.type === CafeViewType.single) {
        return getCafeName({
            cafe: view.value,
            showGroupName,
            useShortNames,
            includeEmoji
        });
    }

    return (useShortNames && view.value.shortName) || view.value.name;
}

export const getTargetSettingForFavorite = (type: SearchEntityType) => {
    if (type === SearchEntityType.menuItem) {
        return ApplicationSettings.favoriteItemNames;
    }

    if (type === SearchEntityType.station) {
        return ApplicationSettings.favoriteStationNames;
    }

    if (type === SearchEntityType.cafe) {
        return ApplicationSettings.homepageViews;
    }

    throw new Error(`Unknown entity type: ${type}`);
};

export const getCafeLocation = (cafe: ICafe): ILocationCoordinates => {
    const location = cafe.location ?? cafe.group?.location;

    if (!location) {
        throw new Error('Cafe has no location!');
    }

    return location;
}

export const isViewAvailable = (view: CafeView, minMenuDate: Date) => {
    if (view.value.firstAvailableDate == null) {
        return true;
    }

    return !isDateBefore(fromDateString(view.value.firstAvailableDate), minMenuDate);
};