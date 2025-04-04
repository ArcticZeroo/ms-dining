import { getMinimumDateForMenu } from '@msdining/common/dist/util/date-util';
import { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../constants/settings.ts';
import { ApplicationContext } from '../context/app.ts';
import { CafeView, CafeViewType, ICafe, ICafeGroup } from '../models/cafe.ts';
import { sortViews } from '../util/sorting.ts';
import { isViewVisible } from '../util/view.ts';
import { useValueNotifier } from './events.ts';

export const useViewDataFromResponse = (groups: ICafeGroup[]) => {
    return useMemo(() => {
        const viewsById = new Map<string, CafeView>();
        const viewsInOrder: CafeView[] = [];
        const cafes: ICafe[] = [];

        for (const group of groups) {
            const groupView = {
                type:  CafeViewType.group,
                value: group
            } as const;

            viewsById.set(group.id, groupView);
            viewsInOrder.push(groupView);

            for (const cafe of group.members) {
                cafe.group = group;

                const cafeView = {
                    type:  CafeViewType.single,
                    value: cafe
                } as const;

                viewsById.set(cafe.id, cafeView);
                viewsInOrder.push(cafeView);
                cafes.push(cafe);
            }
        }

        return { viewsById, viewsInOrder, groups, cafes } as const;
    }, [groups]);
};

export const useVisibleViews = (shouldUseGroups: boolean) => {
    const { viewsInOrder } = useContext(ApplicationContext);

    return useMemo(() => {
        const visibleViews: CafeView[] = [];

        const minMenuDate = getMinimumDateForMenu();
        for (const view of viewsInOrder) {
            if (isViewVisible(view, shouldUseGroups, minMenuDate)) {
                visibleViews.push(view);
            }
        }

        return sortViews(visibleViews);
    }, [viewsInOrder, shouldUseGroups]);
}

export const useViewsForNav = () => {
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    return useVisibleViews(shouldUseGroups);
};

export const useHomepageViews = () => {
    const { viewsById } = useContext(ApplicationContext);

    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    // Users may have added cafes to their home set which are currently unavailable
    return useMemo(() => {
        const availableViews: CafeView[] = [];
        const minMenuDate = getMinimumDateForMenu();

        for (const viewId of homepageViewIds) {
            if (viewsById.has(viewId)) {
                const view = viewsById.get(viewId)!;

                // If the user selected a single view that should be a group, don't show it
                if (isViewVisible(view, shouldUseGroups, minMenuDate)) {
                    availableViews.push(view);
                }
            }
        }

        return sortViews(availableViews);
    }, [viewsById, homepageViewIds, shouldUseGroups]);
}