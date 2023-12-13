import { CafeTypes } from "@msdining/common";

export interface INamedCartItem extends CafeTypes.ICartItem {
    itemName: string;
}