import Duration from '@arcticzeroo/duration';
import { IDiningCoreEntity } from '@msdining/common/dist/models/http';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import { ILocationCoordinates } from '@msdining/common/dist/models/util';
import { fromDateString, isDateBefore } from '@msdining/common/dist/util/date-util';
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

export const isViewAvailable = (view: CafeView, minMenuDate: Date) => {
    if (view.value.firstAvailableDate == null) {
        return true;
    }

    return !isDateBefore(fromDateString(view.value.firstAvailableDate), minMenuDate);
};

const RECENT_OPEN_TIME = new Duration({ days: 10 });

export const didEntityOpenRecently = (entity: IDiningCoreEntity) => {
    if (entity.firstAvailableDate == null) {
        return false;
    }

    const firstAvailableDate = fromDateString(entity.firstAvailableDate);
    const timeSinceFirstAvailableMs = Date.now() - firstAvailableDate.getTime();
    return (timeSinceFirstAvailableMs > 0) && (timeSinceFirstAvailableMs <= RECENT_OPEN_TIME.inMilliseconds);
}