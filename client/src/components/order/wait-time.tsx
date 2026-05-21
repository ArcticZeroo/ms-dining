import React, { useMemo } from 'react';
import { useCartSessionQuery } from '../../store/queries/ordering.ts';
import { useServerCartItems } from '../../store/zustand/server-cart.ts';
import { pluralize } from '../../util/string.js';

export const WaitTime: React.FC = () => {
    const cart = useServerCartItems();
    const { data: cartSessionData, isPending } = useCartSessionQuery();

    const waitTimeView = useMemo(
        () => {
            if (cart.length === 0) {
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
        [cart.length, cartSessionData, isPending]
    );

    if (waitTimeView == null) {
        return null;
    }

    return (
        <div className="centered-content">
            {waitTimeView}
        </div>
    );
};
