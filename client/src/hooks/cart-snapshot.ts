import type { ICartItemRecord } from '@msdining/common/models/cart';
import { useContext, useEffect, useMemo, useState } from 'react';
import { ApplicationContext } from '../context/app.ts';
import { useCartQuery } from '../store/queries/server-cart.ts';
import { useServerCartItems } from '../store/zustand/server-cart.ts';

interface ICafeGroup {
    cafeId: string;
    items: ICartItemRecord[];
}

/**
 * Snapshots the cart items on first load.
 * Returns the frozen snapshot grouped by cafe, sorted by cafe display order.
 * Also provides a callback to remove items after a cafe completes payment.
 */
export const useCartSnapshot = () => {
    const { viewsInOrder } = useContext(ApplicationContext);
    const cartQuery = useCartQuery();
    const serverCartItems = useServerCartItems();

    const [snapshotItems, setSnapshotItems] = useState<ICartItemRecord[]>(() => serverCartItems);
    const [hasSnapshottedCart, setHasSnapshottedCart] = useState(serverCartItems.length > 0);

    useEffect(() => {
        if (hasSnapshottedCart || cartQuery.isPending || cartQuery.isError) {
            return;
        }
        setSnapshotItems(serverCartItems);
        setHasSnapshottedCart(true);
    }, [cartQuery.isError, cartQuery.isPending, hasSnapshottedCart, serverCartItems]);

    const cafeOrderById = useMemo(
        () => new Map(viewsInOrder.map((view, index) => [view.value.id, index])),
        [viewsInOrder],
    );

    const groupedItems = useMemo((): ICafeGroup[] => {
        const byCafe = new Map<string, ICartItemRecord[]>();
        for (const item of snapshotItems) {
            const cafeId = item.menuItem.cafeId;
            const existing = byCafe.get(cafeId);
            if (existing) {
                existing.push(item);
            } else {
                byCafe.set(cafeId, [item]);
            }
        }

        return [...byCafe.entries()]
            .map(([cafeId, items]) => ({ cafeId, items }))
            .sort((left, right) =>
                (cafeOrderById.get(left.cafeId) ?? Number.MAX_SAFE_INTEGER)
                - (cafeOrderById.get(right.cafeId) ?? Number.MAX_SAFE_INTEGER),
            );
    }, [cafeOrderById, snapshotItems]);

    const removeCafeItems = (cafeId: string) => {
        setSnapshotItems(previous => previous.filter(item => item.menuItem.cafeId !== cafeId));
    };

    return {
        isLoading:  !hasSnapshottedCart && cartQuery.isPending,
        isError:    cartQuery.isError && !hasSnapshottedCart,
        cartError:  cartQuery.error,
        groupedItems,
        removeCafeItems,
    };
};
