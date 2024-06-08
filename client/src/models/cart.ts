import { CafeTypes } from '@msdining/common';
import { IMenuItem } from '@msdining/common/dist/models/cafe';
import { ISerializedCartItem } from '@msdining/common/dist/models/cart';
import { CartItemsByCafeId } from '../context/cart.ts';

export interface ICartItemWithMetadata extends CafeTypes.ICartItem {
    id: string;
    cafeId: string;
    associatedItem: IMenuItem;
    price: number;
}

export interface ISerializedCartItemWithName extends ISerializedCartItem {
    name: string;
}

export type ISerializedCartItemsByCafeId = Record<string, Array<ISerializedCartItemWithName>>;

export interface IHydratedCartData {
    foundItemsByCafeId: CartItemsByCafeId;
    missingItemsByCafeId: Map<string /*cafeId*/, Array<ISerializedCartItemWithName>>;
}