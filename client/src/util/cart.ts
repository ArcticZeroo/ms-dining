import { CafeTypes } from '@msdining/common';
import { CartItemsByCafeId } from '../context/cart.ts';
import { ICartItemWithMetadata } from '../models/cart.ts';

export const getPriceDisplay = (price: number, addCurrencySign: boolean = true) => {
    if (price === 0) {
        return '';
    }

    return `${addCurrencySign ? '$' : ''}${price.toFixed(2)}`;
}

const getModifierMax = (modifier: CafeTypes.IMenuItemModifier): number => {
    if (modifier.choiceType === CafeTypes.ModifierChoices.multiSelect) {
        return modifier.maximum;
    }

    // Sometimes the service reports back a max which is higher than the number of possible options.
    return Math.min(modifier.maximum, modifier.choices.length);
}

export const getMinMaxDisplay = (modifier: CafeTypes.IMenuItemModifier) => {
    const min = modifier.minimum;
    const max = getModifierMax(modifier);

    if (min === 0 && max === 0) {
        return '';
    }

    if (min === max) {
        return `Choose ${min}`;
    }

    if (min === 0) {
        return `Choose up to ${max}`;
    }

    return `Choose between ${min} and ${max}`;
}

export const getChoiceHtmlId = (modifier: CafeTypes.IMenuItemModifier, choice: CafeTypes.IMenuItemModifierChoice) => {
    return `choice-${modifier.id}-${choice.id}`;
}

export const addOrEditCartItem = (cart: CartItemsByCafeId, item: ICartItemWithMetadata) => {
    const cafeItems = cart.get(item.cafeId) ?? new Map<string, ICartItemWithMetadata>();

    const existingItem = cafeItems.get(item.id);
    console.log(item, existingItem, existingItem === item);

    cafeItems.set(item.id, item);
    cart.set(item.cafeId, cafeItems);
}

export const removeFromCart = (cart: CartItemsByCafeId, item: ICartItemWithMetadata) => {
    const cafeItems = cart.get(item.cafeId);

    if (!cafeItems) {
        return;
    }

    cafeItems.delete(item.id);

    if (cafeItems.size === 0) {
        cart.delete(item.cafeId);
    }
}

export const clearCart = (cart: CartItemsByCafeId) => {
    cart.clear();
}

export const shallowCloneCart = (cart: CartItemsByCafeId) => {
    const newCart = new Map<string, Map<string, ICartItemWithMetadata>>();

    for (const [cafeId, items] of cart.entries()) {
        newCart.set(cafeId, new Map(items));
    }

    return newCart;
}