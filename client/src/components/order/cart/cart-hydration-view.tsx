import { useServerCartUnavailableItems } from '../../../store/zustand/server-cart.ts';
import { MissingItemsTable } from './missing-items-table.tsx';

import './cart-hydration-view.css';

export const CartHydrationView = () => {
    const unavailableItems = useServerCartUnavailableItems();

    if (unavailableItems.length === 0) {
        return;
    }

    return (
        <div className="cart-hydration-error">
            <span>
                The following items are no longer available. Remove them from your cart to continue.
            </span>
            <MissingItemsTable/>
        </div>
    );
};
