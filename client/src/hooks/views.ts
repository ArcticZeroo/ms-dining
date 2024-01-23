import { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../api/settings.ts';
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

export const useViewsForNav = () => {
    const { viewsInOrder } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    return useMemo(() => {
        const visibleViews: CafeView[] = [];

        for (const view of viewsInOrder) {
            if (isViewVisible(view, shouldUseGroups)) {
                visibleViews.push(view);
            }
        }

        return sortViews(visibleViews);
    }, [viewsInOrder, shouldUseGroups]);
};

export const useHomepageViews = () => {
    const { viewsById } = useContext(ApplicationContext);

    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    // Users may have added cafes to their home set which are currently unavailable
    return useMemo(() => {
        const availableViews: CafeView[] = [];

        for (const viewId of homepageViewIds) {
            if (viewsById.has(viewId)) {
                const view = viewsById.get(viewId)!;

                // If the user selected a single view that should be a group, don't show it
                if (isViewVisible(view, shouldUseGroups)) {
                    availableViews.push(view);
                }
            }
        }

        return sortViews(availableViews);
    }, [viewsById, homepageViewIds, shouldUseGroups]);
}