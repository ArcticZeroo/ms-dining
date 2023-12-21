import { useContext, useEffect, useMemo, useState } from 'react';
import { CafeView, CafeViewType, ICafe, ICafeGroup } from '../models/cafe.ts';
import { ApplicationContext } from '../context/app.ts';
import { isViewVisible } from '../util/view.ts';
import { useValueNotifier } from './events.ts';
import { ApplicationSettings } from '../api/settings.ts';

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
                    cafe.group = group.id;
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

export const useVisibleViews = () => {
    const { viewsInOrder } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const [visibleViews, setVisibleViews] = useState<Array<CafeView>>([]);

    useEffect(() => {
        const newVisibleViews: CafeView[] = [];

        for (const view of viewsInOrder) {
            if (isViewVisible(shouldUseGroups, view)) {
                newVisibleViews.push(view);
            }
        }

        setVisibleViews(newVisibleViews);
    }, [viewsInOrder, shouldUseGroups]);

    return visibleViews;
};