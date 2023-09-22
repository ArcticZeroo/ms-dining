import { DiningHallView, DiningHallViewType, IDiningHall } from '../models/dining-halls';

export const expandAndFlattenView = (view: DiningHallView | string, viewsById: Map<string, DiningHallView>): Array<IDiningHall> => {
    if (typeof view === 'string') {
        const possibleView = viewsById.get(view);
        if (!possibleView) {
            throw new Error(`Missing view with id ${view}`);
        }
        view = possibleView;
    }

    if (view.type === DiningHallViewType.single) {
        return [view.value];
    }

    return view.value.members.flatMap(viewId => expandAndFlattenView(viewId, viewsById));
}

export const getParentView = (viewsById: Map<string, DiningHallView>, useGroups: boolean, view: DiningHallView) => {
    if (view.type === DiningHallViewType.group) {
        return view;
    }

    if (!view.value.group || !useGroups) {
        return view;
    }

    const parentView = viewsById.get(view.value.group);
    if (!parentView) {
        throw new Error(`Missing parent view with id ${view.value.group}`);
    }

    return parentView;
}

export const isViewVisible = (useGroups: boolean, view: DiningHallView) => {
    if (useGroups) {
        return view.type === DiningHallViewType.group || !view.value.group;
    } else {
        return view.type === DiningHallViewType.single;
    }
}
