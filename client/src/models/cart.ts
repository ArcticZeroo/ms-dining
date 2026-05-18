import { CafeTypes } from '@msdining/common';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { ISerializedCartItem } from '@msdining/common/models/cart';

export interface ICartItemWithMetadata extends CafeTypes.ICartItem {
    id: string;
    cafeId: string;
    associatedItem: IMenuItemBase;
    price: number;
}

export type CartItemsByCafeId = Map<string, Map<string, ICartItemWithMetadata>>;

export interface ISerializedCartItemWithName extends ISerializedCartItem {
    name: string;
}

export type ISerializedCartItemsByCafeId = Record<string, Array<ISerializedCartItemWithName>>;

export interface IHydratedCartData {
    foundItemsByCafeId: CartItemsByCafeId;
    missingItemsByCafeId: Map<string /*cafeId*/, Array<ISerializedCartItemWithName>>;
}