import type { ICartItemRecord } from '@msdining/common/models/cart';
import { useContext, useMemo } from 'react';
import { CurrentCafeContext } from '../context/menu-item.ts';
import { useCartEstimateQuery } from '../store/queries/ordering.ts';
import { groupByStation } from '../util/cart.ts';

export interface IOrderCafeStationGroup {
    stationName: string;
    stationItems: ICartItemRecord[];
}

export type IOrderCafeItemsEstimate = NonNullable<ReturnType<typeof useCartEstimateQuery>['data']>;

interface IOrderCafeItemsTableData {
    cafeId?: string;
    estimate?: IOrderCafeItemsEstimate;
    stationGroups: IOrderCafeStationGroup[];
}

const toOrderCafeStationGroups = (items: ICartItemRecord[]): IOrderCafeStationGroup[] =>
    Array.from(groupByStation(items), ([stationName, stationItems]) => ({
        stationName,
        stationItems,
    }));

export const getOrderCafeStationGroupKey = (stationName: string): string => stationName || 'other';

export const useOrderCafeItemsTable = (
    items: ICartItemRecord[],
    hasUnavailableItems: boolean,
): IOrderCafeItemsTableData => {
    const cafe = useContext(CurrentCafeContext);
    const cafeId = items[0]?.menuItem.cafeId;
    const stationGroups = useMemo(() => toOrderCafeStationGroups(items), [items]);
    const { data: estimate } = useCartEstimateQuery(cafe.id, hasUnavailableItems);

    return {
        cafeId,
        estimate,
        stationGroups,
    };
};
