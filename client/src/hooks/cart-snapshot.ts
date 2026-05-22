import type { ICartItemRecord } from '@msdining/common/models/cart';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

    const onItemRemoved = useCallback((itemId: string) => {
        setSnapshotItems(previous => previous.filter(item => item.id !== itemId));
    }, []);

    const onItemQuantityChanged = useCallback((itemId: string, quantity: number) => {
        setSnapshotItems(previous => previous.map(item =>
            item.id === itemId ? { ...item, quantity } : item,
        ));
    }, []);

    // Sync edits from the server cart store into the snapshot.
    // This handles the edit popup flow where mutations go to the store
    // but the snapshot doesn't see them.
    useEffect(() => {
        if (!hasSnapshottedCart) {
            return;
        }

        setSnapshotItems(previous => {
            let changed = false;
            const updated = previous.map(snapshotItem => {
                const storeItem = serverCartItems.find(item => item.id === snapshotItem.id);
                if (storeItem && storeItem !== snapshotItem) {
                    changed = true;
                    return storeItem;
                }
                return snapshotItem;
            });
            return changed ? updated : previous;
        });
    }, [hasSnapshottedCart, serverCartItems]);

    return {
        isLoading:  !hasSnapshottedCart && cartQuery.isPending,
        isError:    cartQuery.isError && !hasSnapshottedCart,
        cartError:  cartQuery.error,
        groupedItems,
        onItemRemoved,
        onItemQuantityChanged,
    };
};
