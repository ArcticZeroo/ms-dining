import { CafeTypes } from "@msdining/common";
import { IMenuItem } from './cafe.ts';

export interface ICartItemWithMetadata extends CafeTypes.ICartItem {
    id: string;
    cafeId: string;
    associatedItem: IMenuItem;
    price: number;
}