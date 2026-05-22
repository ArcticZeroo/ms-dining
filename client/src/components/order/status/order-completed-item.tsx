import React, { useMemo } from 'react';
import { classNames } from '../../../util/react.ts';
import { formatEstimatedReadyTime, formatWaitTime } from '../../../util/order.ts';

interface IOrderCompletedItemProps {
    cafeName: string;
    buyOnDemandOrderNumber: string | null;
    waitTimeMin: number | null;
    waitTimeMax: number | null;
    completedAt?: Date | null;
}

export const OrderCompletedItem: React.FC<IOrderCompletedItemProps> = ({
    cafeName,
    buyOnDemandOrderNumber,
    waitTimeMin,
    waitTimeMax,
    completedAt,
}) => {
    const hasWaitTime = waitTimeMin != null && waitTimeMax != null;

    const estimatedReadyLabel = useMemo(() => {
        if (!hasWaitTime || !completedAt) {
            return undefined;
        }
        return formatEstimatedReadyTime(completedAt, waitTimeMin, waitTimeMax);
    }, [completedAt, hasWaitTime, waitTimeMin, waitTimeMax]);

    return (
        <div className={classNames('card', 'dark-blue')}>
            <div className="title">
                {cafeName}
                {buyOnDemandOrderNumber && ` - Order #${buyOnDemandOrderNumber}`}
            </div>
            <div>
                Your order was successfully submitted! You should receive a text message with order updates.
            </div>
            {hasWaitTime && (
                <div>
                    Estimated wait: {formatWaitTime(waitTimeMin, waitTimeMax)}
                </div>
            )}
            {estimatedReadyLabel && (
                <div>
                    Estimated ready: {estimatedReadyLabel}
                </div>
            )}
        </div>
    );
};