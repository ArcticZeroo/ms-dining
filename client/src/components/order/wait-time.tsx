import React, { useMemo } from 'react';
import { IPrepareCartResponse } from '@msdining/common/models/cart';
import { pluralize } from '../../util/string.js';

interface IWaitTimeProps {
    cartSessionData?: IPrepareCartResponse | null;
}

export const WaitTime: React.FC<IWaitTimeProps> = ({ cartSessionData }) => {
    const waitTimeView = useMemo(
        () => {
            if (!cartSessionData) {
                return 'Loading wait time...';
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
        [cartSessionData]
    );

    return (
        <div className="centered-content">
            {waitTimeView}
        </div>
    );
}