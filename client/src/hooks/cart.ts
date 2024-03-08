import { useCallback, useEffect, useMemo } from 'react';
import { CartItemsByCafeId, ICartHydrationState } from '../context/cart.ts';
import { useValueNotifier } from './events.ts';
import { InternalSettings } from '../constants/settings.ts';
import { OrderingClient } from '../api/order.ts';
import { IHydratedCartData, ISerializedCartItemsByCafeId, ISerializedCartItemWithName } from '../models/cart.ts';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { ValueNotifier } from '../util/events.ts';

const BOOT_CART_DATA = InternalSettings.cart.value;

const serializeCart = (cart: CartItemsByCafeId, cartHydrationNotifier: ValueNotifier<ICartHydrationState>): ISerializedCartItemsByCafeId => {
    const serializedValue: Record<string /*cafeId*/, Array<ISerializedCartItemWithName>> = {};
    const missingItemsByCafeId = cartHydrationNotifier.value.missingItemsByCafeId;

    for (const [cafeId, itemsById] of cart.entries()) {
        const serializedItems: ISerializedCartItemWithName[] = [];

        for (const item of itemsById.values()) {
            serializedItems.push({
                itemId:              item.itemId,
                name:                item.associatedItem.name,
                quantity:            item.quantity,
                modifiers:           Array.from(item.choicesByModifierId.entries()).map(([modifierId, choiceIds]) => ({
                    modifierId,
                    choiceIds: Array.from(choiceIds)
                })),
                specialInstructions: item.specialInstructions
            });
        }

        if (missingItemsByCafeId != null) {
            const missingItemsForCafe = missingItemsByCafeId.get(cafeId) ?? [];
            serializedItems.push(...missingItemsForCafe);
        }

        serializedValue[cafeId] = serializedItems;
    }

    return serializedValue;
}

export const useCartHydration = (cartNotifier: ValueNotifier<CartItemsByCafeId>) => {
    const cart = useValueNotifier(cartNotifier);
    const cartHydrationNotifier = useMemo(
        () => new ValueNotifier<ICartHydrationState>({
            stage: PromiseStage.notRun
        }),
        []
    );

    useEffect(() => {
        InternalSettings.cart.value = serializeCart(cart, cartHydrationNotifier);
    }, [cart, cartHydrationNotifier]);

    const hydrateCart = useCallback(async (bootCartData: ISerializedCartItemsByCafeId) => {
        try {
            cartHydrationNotifier.value = { stage: PromiseStage.running };

            const hydratedCartData: IHydratedCartData = await OrderingClient.hydrateCart(bootCartData);

            cartHydrationNotifier.value = {
                stage:                PromiseStage.success,
                missingItemsByCafeId: hydratedCartData.missingItemsByCafeId
            };

            cartNotifier.value = hydratedCartData.foundItemsByCafeId;
        } catch (err) {
            console.error('Could not hydrate cart:', err);
            cartHydrationNotifier.value = {
                stage:                PromiseStage.error,
                missingItemsByCafeId: new Map(Object.entries(bootCartData))
            };
        }

        // Ok, this is pretty hacky, but prevents us from losing cart data on initial boot.
        InternalSettings.cart.value = bootCartData;
    }, [cartHydrationNotifier, cartNotifier]);

    useEffect(() => {
        if (!BOOT_CART_DATA || Object.keys(BOOT_CART_DATA).length === 0) {
            return;
        }

        hydrateCart(BOOT_CART_DATA)
            .catch(err => console.error('Could not hydrate cart:', err));
    }, [hydrateCart]);

    return cartHydrationNotifier;
};