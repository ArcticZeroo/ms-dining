import type { ICafeOrder } from '@msdining/common/models/order';
import { isSameDate } from '@msdining/common/util/date-util';
import { useContext, useMemo } from 'react';
import { ApplicationContext } from '../context/app.js';
import type { CafeView } from '../models/cafe.js';
import { getViewName } from '../util/cafe.js';

interface ICompletedOrderCardHeaderData {
    cafeName: string;
    isToday: boolean;
    view?: CafeView;
}

export const useCompletedOrderCardHeader = (order: ICafeOrder): ICompletedOrderCardHeaderData => {
    const { viewsById } = useContext(ApplicationContext);
    const view = viewsById.get(order.cafeId);
    const cafeName = view == null ? order.cafeId : getViewName({ view, showGroupName: true });
    const isToday = useMemo(
        () => isSameDate(order.completedAt, new Date()),
        [order.completedAt],
    );

    return { cafeName, isToday, view };
};
