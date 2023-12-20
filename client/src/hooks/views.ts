import { useContext, useEffect, useState } from 'react';
import { CafeView, CafeViewType, ICafeGroup } from '../models/cafe.ts';
import { ApplicationContext } from '../context/app.ts';
import { isViewVisible } from '../util/view.ts';
import { useValueNotifier } from './events.ts';
import { ApplicationSettings } from '../api/settings.ts';

export const useViewDataFromResponse = (groups: ICafeGroup[]) => {
    const [viewsById, setViewsById] = useState<Map<string, CafeView>>(new Map());
    const [viewsInOrder, setViewsInOrder] = useState<Array<CafeView>>([]);

    useEffect(() => {
        const viewsById = new Map<string, CafeView>();
        const viewsInOrder: CafeView[] = [];

        for (const group of groups) {
            const groupView = {
                type:  CafeViewType.group,
                value: group
            } as const;

            viewsById.set(group.id, groupView);
            viewsInOrder.push(groupView);

            for (const cafe of group.members) {
                const cafeView = {
                    type:  CafeViewType.single,
                    value: cafe
                } as const;

                viewsById.set(cafe.id, cafeView);
                viewsInOrder.push(cafeView);
            }
        }

        setViewsById(viewsById);
        setViewsInOrder(viewsInOrder);
    }, [groups]);

    return { viewsById, viewsInOrder } as const;
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