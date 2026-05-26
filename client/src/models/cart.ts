import { IMenuItemBase } from '@msdining/common/models/cafe';
import { ISerializedModifier } from '@msdining/common/models/cart';

export interface ISerializedCartItem {
    itemId: string;
    quantity: number;
    modifiers: Array<ISerializedModifier>;
    specialInstructions?: string;
}

export interface ICartItemWithMetadata {
    id: string;
    cafeId: string;
    itemId: string;
    quantity: number;
    choicesByModifierId: Map<string, Set<string>>;
    specialInstructions?: string;
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