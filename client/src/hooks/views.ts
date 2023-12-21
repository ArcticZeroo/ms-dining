import { useContext, useMemo } from 'react';
import { ApplicationContext } from '../context/app.ts';
import { CafeView, CafeViewType, ICafe, ICafeGroup } from '../models/cafe.ts';
import { sortViews } from '../util/sorting.ts';
import { isViewVisible } from '../util/view.ts';

export const useViewDataFromResponse = (groups: ICafeGroup[]) => {
    return useMemo(() => {
        const viewsById = new Map<string, CafeView>();
        const viewsInOrder: CafeView[] = [];
        const cafes: ICafe[] = [];

        for (const group of groups) {
            if (!group.alwaysExpand) {
                const groupView = {
                    type:  CafeViewType.group,
                    value: group
                } as const;

                viewsById.set(group.id, groupView);
                viewsInOrder.push(groupView);
            }

            for (const cafe of group.members) {
                if (!group.alwaysExpand) {
                    cafe.group = group;
                }

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

    return useMemo(() => {
        const visibleViews: CafeView[] = [];

        for (const view of viewsInOrder) {
            if (isViewVisible(view)) {
                visibleViews.push(view);
            }
        }

        return sortViews(visibleViews);
    }, [viewsInOrder]);
};