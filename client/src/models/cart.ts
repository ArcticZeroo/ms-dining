import { CafeTypes } from "@msdining/common";
import { IMenuItem } from './cafe.ts';

export interface ICartItemWithMetadata extends CafeTypes.ICartItem {
    associatedItem: IMenuItem;
    price: number;
}