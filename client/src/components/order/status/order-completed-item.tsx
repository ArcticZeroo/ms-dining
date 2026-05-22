import React, { useMemo } from 'react';
import { classNames } from '../../../util/react.ts';

interface IOrderCompletedItemProps {
    cafeName: string;
    buyOnDemandOrderNumber: string | null;
    waitTimeMin: number | null;
    waitTimeMax: number | null;
    completedAt?: string | null;
}

export const OrderCompletedItem: React.FC<IOrderCompletedItemProps> = ({
    cafeName,
    buyOnDemandOrderNumber,
    waitTimeMin,
    waitTimeMax,
    completedAt,
}) => {
    const completedAtLabel = useMemo(
        () => completedAt ? new Date(completedAt).toLocaleString() : undefined,
        [completedAt],
    );

    return (
        <div className={classNames('card', 'dark-blue')}>
            <div className="title">
                {cafeName}
                {buyOnDemandOrderNumber && ` - Order #${buyOnDemandOrderNumber}`}
            </div>
            <div>
                Your order was successfully submitted! You should receive a text message with order updates.
            </div>
            {(waitTimeMin != null && waitTimeMax != null) && (
                <div>
                    Estimated wait time: {waitTimeMin} - {waitTimeMax} minutes
                </div>
            )}
            {completedAtLabel && (
                <div>
                    Completed: {completedAtLabel}
                </div>
            )}
        </div>
    );
};