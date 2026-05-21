import React from 'react';
import { useServerCartItems } from '../../store/zustand/server-cart.ts';

export const WaitTime: React.FC = () => {
    const cart = useServerCartItems();

    if (cart.length === 0) {
        return null;
    }

    // Wait time requires the checkout flow (BoD session) which hasn't
    // been migrated to the new cart yet. Will be restored with the
    // new ordering endpoints.
    return null;
};
