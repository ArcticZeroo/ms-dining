import { CafeTypes } from '@msdining/common';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { CartItemsByCafeId } from '../context/cart.ts';
import { ICartItemWithMetadata } from '../models/cart.ts';

export const formatPrice = (price: number, addCurrencySign: boolean = true) => {
    return `${addCurrencySign ? '$' : ''}${price.toFixed(2)}`;
}

/**
 * Like formatPrice, but returns an empty string if it's free. Intended to be used for things like modifiers.
 * @param price
 * @param addCurrencySign
 */
export const maybeFormatPrice = (price: number, addCurrencySign: boolean = true) => {
    if (price === 0) {
        return '';
    }

    return formatPrice(price, addCurrencySign);
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

export const calculatePrice = (menuItem: IMenuItemBase, selectedChoiceIdsByModifierId: Map<string, Set<string>>, quantity: number = 1): number => {
    let price = menuItem.price;

    for (const modifier of menuItem.modifiers) {
        const selectedChoiceIds = selectedChoiceIdsByModifierId.get(modifier.id) ?? new Set<string>();

        for (const choice of modifier.choices) {
            if (selectedChoiceIds.has(choice.id)) {
                price += choice.price;
            }
        }
    }

    return price * quantity;
};

export const getModifierMinCost = (modifier: CafeTypes.IMenuItemModifier): number => {
    if (modifier.minimum <= 0 || modifier.choices.length === 0) {
        return 0;
    }

    const sortedPrices = modifier.choices.map(choice => choice.price).sort((priceA, priceB) => priceA - priceB);
    let total = 0;
    for (let i = 0; i < Math.min(modifier.minimum, sortedPrices.length); i++) {
        total += sortedPrices[i]!;
    }
    return total;
};

export const getMinRequiredPrice = (menuItem: IMenuItemBase): number => {
    let price = menuItem.price;
    for (const modifier of menuItem.modifiers) {
        price += getModifierMinCost(modifier);
    }
    return price;
};

export const hasModifierPriceBeyondMinimum = (menuItem: IMenuItemBase): boolean => {
    for (const modifier of menuItem.modifiers) {
        const prices = modifier.choices.map(choice => choice.price);
        if (modifier.minimum === 0) {
            // Optional modifier: any non-zero price means price can increase
            if (prices.some(price => price > 0)) {
                return true;
            }
        } else {
            // Required modifier: price can increase if choices have different prices
            if (Math.max(...prices) > Math.min(...prices)) {
                return true;
            }
            // Or if you can select more than the minimum and any choice has a price
            if (modifier.maximum > modifier.minimum && prices.some(price => price > 0)) {
                return true;
            }
        }
    }
    return false;
};
