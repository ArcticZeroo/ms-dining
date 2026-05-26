import type { ICafeCartGroup, ICartItemUpdate } from '@msdining/common/models/cart';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApplicationContext } from '../context/app.ts';
import { useCartQuery } from '../store/queries/server-cart.ts';
import { useServerCartItemsByCafe } from '../store/zustand/server-cart.ts';

type ICafeGroup = ICafeCartGroup;

/**
 * Snapshots the cart items on first load.
 * The snapshot is the source of truth for the order page — edits flow
 * snapshot → cart (one-way), never cart → snapshot.
 */
export const useCartSnapshot = () => {
    const { viewsInOrder } = useContext(ApplicationContext);
    const cartQuery = useCartQuery();
    const serverCartCafes = useServerCartItemsByCafe();

    const [snapshotCafes, setSnapshotCafes] = useState<ICafeGroup[]>(() => serverCartCafes);
    const [hasSnapshottedCart, setHasSnapshottedCart] = useState(serverCartCafes.length > 0);

    useEffect(() => {
        if (hasSnapshottedCart || cartQuery.isPending || cartQuery.isError) {
            return;
        }
        setSnapshotCafes(serverCartCafes);
        setHasSnapshottedCart(true);
    }, [cartQuery.isError, cartQuery.isPending, hasSnapshottedCart, serverCartCafes]);

    const cafeOrderById = useMemo(
        () => new Map(viewsInOrder.map((view, index) => [view.value.id, index])),
        [viewsInOrder],
    );

    const groupedItems = useMemo((): ICafeGroup[] => {
        return [...snapshotCafes].sort((left, right) =>
            (cafeOrderById.get(left.cafeId) ?? Number.MAX_SAFE_INTEGER)
            - (cafeOrderById.get(right.cafeId) ?? Number.MAX_SAFE_INTEGER),
        );
    }, [cafeOrderById, snapshotCafes]);

    const removeItem = useCallback((itemId: string) => {
        setSnapshotCafes(previous => previous.flatMap(cafe => {
            const items = cafe.items.filter(item => item.id !== itemId);
            if (items.length === cafe.items.length) {
                return [cafe];
            }
            return items.length > 0 ? [{ ...cafe, items }] : [];
        }));
    }, []);

    const updateItem = useCallback((itemId: string, update: ICartItemUpdate) => {
        setSnapshotCafes(previous => previous.map(cafe => ({
            ...cafe,
            items: cafe.items.map(item => {
                if (item.id !== itemId) {
                    return item;
                }
                return {
                    ...item,
                    ...(update.quantity !== undefined && { quantity: update.quantity }),
                    ...(update.specialInstructions !== undefined && { specialInstructions: update.specialInstructions }),
                    ...(update.modifiers !== undefined && { modifiers: update.modifiers }),
                };
            }),
        })));
    }, []);

    return {
        isLoading:  !hasSnapshottedCart && cartQuery.isPending,
        isError:    cartQuery.isError && !hasSnapshottedCart,
        cartError:  cartQuery.error,
        groupedItems,
        removeItem,
        updateItem,
    };
};
