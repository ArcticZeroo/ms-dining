import type { ICartItemRecord } from '@msdining/common/models/cart';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApplicationContext } from '../context/app.ts';
import { useCartQuery } from '../store/queries/server-cart.ts';
import { useServerCartItems } from '../store/zustand/server-cart.ts';

interface ICafeGroup {
    cafeId: string;
    items: ICartItemRecord[];
}

export interface ICompletedCafeSummary {
    cafeId: string;
    buyOnDemandOrderNumber: string;
}

/**
 * Snapshots the cart items on first load.
 * Returns the frozen snapshot grouped by cafe, sorted by cafe display order.
 * Also tracks cafes that have completed payment within the current snapshot.
 */
export const useCartSnapshot = () => {
    const { viewsInOrder } = useContext(ApplicationContext);
    const cartQuery = useCartQuery();
    const serverCartItems = useServerCartItems();

    const [snapshotItems, setSnapshotItems] = useState<ICartItemRecord[]>(() => serverCartItems);
    const [hasSnapshottedCart, setHasSnapshottedCart] = useState(serverCartItems.length > 0);
    const [completedCafes, setCompletedCafes] = useState<ICompletedCafeSummary[]>([]);

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

    const setCafeCompleted = useCallback((cafeId: string, buyOnDemandOrderNumber: string) => {
        setSnapshotItems(previous => previous.filter(item => item.menuItem.cafeId !== cafeId));
        setCompletedCafes(previous => [
            ...previous.filter(item => item.cafeId !== cafeId),
            { cafeId, buyOnDemandOrderNumber },
        ]);
    }, []);

    return {
        isLoading:  !hasSnapshottedCart && cartQuery.isPending,
        isError:    cartQuery.isError && !hasSnapshottedCart,
        cartError:  cartQuery.error,
        groupedItems,
        completedCafes,
        setCafeCompleted,
    };
};
