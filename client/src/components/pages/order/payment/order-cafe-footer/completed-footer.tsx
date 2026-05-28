import type { ICompleteOrderResult } from '@msdining/common/models/order';
import React from 'react';
import { formatEstimatedReadyTime } from '../../../../../util/order.ts';

interface ICompletedFooterProps {
    result: ICompleteOrderResult;
}

export const CompletedFooter: React.FC<ICompletedFooterProps> = ({ result }) => (
    <div className="order-cafe-notice ready flex-center">
        <span className="material-symbols-outlined">check_circle</span>
        <span>Order #{result.buyOnDemandOrderNumber}</span>
        <span>Ready at {formatEstimatedReadyTime(result.completedAt, result.waitTimeMin, result.waitTimeMax)}</span>
    </div>
);
