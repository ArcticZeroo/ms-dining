import React, { useMemo } from 'react';
import { useCartStore } from '../../store/zustand/cart.ts';
import { useCartSessionQuery } from '../../store/queries/ordering.ts';
import { pluralize } from '../../util/string.js';

export const WaitTime: React.FC = () => {
    const cart = useCartStore((state) => state.items);
    const { data: cartSessionData, isPending } = useCartSessionQuery();

    const waitTimeView = useMemo(
        () => {
            if (cart.size === 0) {
                return null;
            }

            if (!cartSessionData) {
                return isPending ? 'Loading wait time...' : null;
            }

            let minTime = 0;
            let maxTime = 0;

            for (const cafeData of Object.values(cartSessionData)) {
                minTime = Math.max(minTime, cafeData.waitTimeMin);
                maxTime = Math.max(maxTime, cafeData.waitTimeMax);
            }

            if (minTime === maxTime) {
                return `Estimated wait time: ${minTime} ${pluralize('minute', minTime)}`;
            }

            return `Estimated wait time: ${minTime} - ${maxTime} minutes`;
        },
        [cart.size, cartSessionData, isPending]
    );

    if (waitTimeView == null) {
        return null;
    }

    return (
        <div className="centered-content">
            {waitTimeView}
        </div>
    );
}