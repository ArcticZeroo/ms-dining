import { useContext, useEffect, useState } from 'react';
import {
    CafeView,
    CafeViewType,
    ICafe,
    ICafeGroupWithoutMembers
} from '../models/cafe.ts';
import { sortCafeIds } from '../util/sorting';
import { ApplicationContext } from '../context/app.ts';
import { isViewVisible } from '../util/view.ts';
import { useValueNotifier } from './events.ts';
import { ApplicationSettings } from '../api/settings.ts';

export const useViewDataFromResponse = (cafes: ICafe[], groups: ICafeGroupWithoutMembers[]) => {
    const [viewsById, setViewsById] = useState<Map<string, CafeView>>(new Map());
    const [viewsInOrder, setViewsInOrder] = useState<Array<CafeView>>([]);

    useEffect(() => {
        const viewsById = new Map<string, CafeView>();

        for (const group of groups) {
            viewsById.set(group.id, {
                type:  CafeViewType.group,
                value: {
                    ...group,
                    members: []
                }
            });
        }

        for (const cafe of cafes) {
            viewsById.set(cafe.id, {
                type:  CafeViewType.single,
                value: cafe
            });

            if (cafe.group) {
                if (!viewsById.has(cafe.group)) {
                    throw new Error(`Missing cafe group with id ${cafe.group}`);
                }

                const groupView = viewsById.get(cafe.group)!;
                if (groupView.type !== CafeViewType.group) {
                    throw new Error(`View with id ${cafe.group} has the wrong view type!`);
                }

                groupView.value.members.push(cafe.id);
            }
        }

        setViewsById(viewsById);

        const viewIdsInOrder = sortCafeIds(Array.from(viewsById.keys()));
        const viewsInOrder = viewIdsInOrder.map(viewId => viewsById.get(viewId)!);

        setViewsInOrder(viewsInOrder);
    }, [cafes, groups]);

    return { viewsById, viewsInOrder } as const;
}

export const useVisibleViews = () => {
    const { viewsInOrder } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.useGroups);
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