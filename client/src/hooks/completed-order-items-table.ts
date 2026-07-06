import type { ICafeOrderItem } from '@msdining/common/models/order';
import { groupByStation } from '../util/cart.ts';

interface ICompletedOrderItemsTableData {
    cafeId?: string;
    stationGroups: Map<string, ICafeOrderItem[]>;
}

export const useCompletedOrderItemsTable = (items: ICafeOrderItem[]): ICompletedOrderItemsTableData => {
    return {
        cafeId:        items[0]?.menuItem.cafeId,
        stationGroups: groupByStation(items),
    };
};
