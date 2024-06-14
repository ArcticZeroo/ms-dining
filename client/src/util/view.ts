import { ILocationCoordinates, Nullable } from '@msdining/common/dist/models/util';
import { CafeView, CafeViewType, ICafe, ICafeGroup } from '../models/cafe.ts';
import { getCafeLocation } from './cafe.ts';

export const expandAndFlattenView = (view: CafeView | string, viewsById: Map<string, CafeView>): Array<ICafe> => {
    if (typeof view === 'string') {
        const possibleView = viewsById.get(view);
        if (!possibleView) {
            throw new Error(`Missing view with id ${view}`);
        }
        view = possibleView;
    }

    if (view.type === CafeViewType.single) {
        return [view.value];
    }

    return view.value.members.flatMap(cafe => expandAndFlattenView(cafe.id, viewsById));
};

const isGroupVisibleWithGroupsAllowed = (group: ICafeGroup) => group.members.length > 0 && !group.alwaysExpand;

export const getParentView = (viewsById: Map<string, CafeView>, view: CafeView, shouldUseGroups: boolean) => {
    // Even if we don't use groups normally, users can link group pages to each other.
    // ...there's also no way to figure out which child was intended since all we have is the group here.
    if (view.type === CafeViewType.group) {
        return view;
    }

    // If we don't want to display the parent group for any reason, use the single view
    if (!view.value.group || !shouldUseGroups || !isGroupVisibleWithGroupsAllowed(view.value.group)) {
        return view;
    }

    const parentView = viewsById.get(view.value.group.id);
    if (!parentView) {
        throw new Error(`Missing parent view with id ${view.value.group}`);
    }

    return parentView;
};

export const isViewVisible = (view: Nullable<CafeView>, shouldUseGroups: boolean) => {
    if (view == null) {
        return false;
    }

    if (!shouldUseGroups) {
        return view.type === CafeViewType.single;
    } else {
        if (view.type === CafeViewType.group) {
            return isGroupVisibleWithGroupsAllowed(view.value);
        }

        return !view.value.group || !isGroupVisibleWithGroupsAllowed(view.value.group);
    }
};

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
        lat: totalLat / view.value.members.length,
        long: totalLong / view.value.members.length
    }
}

export const getViewEmoji = (view: CafeView) => view.type === CafeViewType.single && view.value.emoji
    ? view.value.emoji
    : '🍴';

// Intended for cases like Food Hall 4
export const getViewPrimaryCafe = (view: CafeView): ICafe | undefined => view.type === CafeViewType.single
    ? view.value
    : view.value.members.find(member => member.name === view.value.name);