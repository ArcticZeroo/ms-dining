import { CafeView, CafeViewType, ICafe } from '../models/cafe.ts';

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

export const getParentView = (viewsById: Map<string, CafeView>, view: CafeView) => {
    if (view.type === CafeViewType.group) {
        return view;
    }

    // Some cafes have no parent (or their parent is set to always expand, in which case the parent is not shown)
    if (!view.value.group || view.value.group.alwaysExpand) {
        return view;
    }

    const parentView = viewsById.get(view.value.group.id);
    if (!parentView) {
        throw new Error(`Missing parent view with id ${view.value.group}`);
    }

    return parentView;
};

export const isViewVisible = (view: CafeView) => {
    if (view.type === CafeViewType.group) {
        return view.value.members.length > 0 && !view.value.alwaysExpand;
    }
    // Views with a group should not be displayed, we want to display their parent group instead.
    // There should never be a view with a group id whose group data wasn't received from the server.
    return !view.value.group;
};
