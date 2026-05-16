import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { useCallback, useEffect, useMemo } from 'react';
import { OrderingClient } from '../api/order.ts';
import { InternalSettings } from '../constants/settings.ts';
import { CartItemsByCafeId, ICartHydrationState } from '../context/cart.ts';
import { ISerializedCartItemsByCafeId, ISerializedCartItemWithName } from '../models/cart.ts';
import { ValueNotifier } from '../util/events.ts';
import { useValueNotifier } from './events.ts';

type MissingItemsByCafeId = Map<string, Array<ISerializedCartItemWithName>>;

const serializeCart = (cart: CartItemsByCafeId, missingItemsByCafeId: MissingItemsByCafeId): ISerializedCartItemsByCafeId => {
    const serializedValue: ISerializedCartItemsByCafeId = {};

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

        const missingItemsForCafe = missingItemsByCafeId.get(cafeId) ?? [];
        serializedItems.push(...missingItemsForCafe);

        serializedValue[cafeId] = serializedItems;
    }

    // Also persist cafes that exist only as missing items (e.g. hydration failed
    // and nothing has been added to the live cart yet). Without this, the next
    // save would wipe the un-hydrated items from localStorage.
    for (const [cafeId, missingItems] of missingItemsByCafeId.entries()) {
        if (missingItems.length === 0 || serializedValue[cafeId] != null) {
            continue;
        }

        serializedValue[cafeId] = [...missingItems];
    }

    return serializedValue;
};

export const useCartHydration = (cartNotifier: ValueNotifier<CartItemsByCafeId>) => {
    const cart = useValueNotifier(cartNotifier);

    const missingItemsNotifier = useMemo(
        () => new ValueNotifier<MissingItemsByCafeId>(new Map()),
        []
    );
    const missingItems = useValueNotifier(missingItemsNotifier);

    const { stage, run: retry } = useDelayedPromiseState(
        useCallback(async () => {
            const bootCartData = InternalSettings.cart.value;
            if (!bootCartData || Object.keys(bootCartData).length === 0) {
                cartNotifier.value = new Map();
                missingItemsNotifier.value = new Map();
                return;
            }

            try {
                const data = await OrderingClient.hydrateCart(bootCartData);
                cartNotifier.value = data.foundItemsByCafeId;
                missingItemsNotifier.value = data.missingItemsByCafeId;
            } catch (err) {
                // Preserve every booted item as "missing" so the user can retry
                // or remove them manually rather than losing their cart silently.
                missingItemsNotifier.value = new Map(Object.entries(bootCartData));
                throw err;
            }
        }, [cartNotifier, missingItemsNotifier])
    );

    const clearMissingItems = useCallback(() => {
        missingItemsNotifier.value = new Map();
    }, [missingItemsNotifier]);

    useEffect(() => {
        retry();
    }, [retry]);

    // Persist cart + missing items to localStorage whenever they change, but
    // not while hydration is in flight (that would clobber the persisted data
    // before we know what the server is going to give us back).
    useEffect(() => {
        if (stage === PromiseStage.notRun || stage === PromiseStage.running) {
            return;
        }

        InternalSettings.cart.value = serializeCart(cart, missingItems);
    }, [cart, missingItems, stage]);

    // Expose a single ValueNotifier so context consumers can subscribe to the
    // combined hydration state in one place.
    const cartHydrationNotifier = useMemo(
        () => new ValueNotifier<ICartHydrationState>({
            stage:                PromiseStage.notRun,
            missingItemsByCafeId: new Map(),
            retry,
            clearMissingItems
        }),
        // retry/clearMissingItems are stable - safe to omit
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    useEffect(() => {
        cartHydrationNotifier.value = {
            stage,
            missingItemsByCafeId: missingItems,
            retry,
            clearMissingItems
        };
    }, [stage, missingItems, retry, clearMissingItems, cartHydrationNotifier]);

    return cartHydrationNotifier;
};