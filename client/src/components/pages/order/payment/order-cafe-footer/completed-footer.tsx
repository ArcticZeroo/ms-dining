import type { ICompleteOrderResult } from '@msdining/common/models/order';
import React from 'react';
import { formatWaitTime } from '../../../../../util/order.ts';

interface ICompletedFooterProps {
    result: ICompleteOrderResult;
}

export const CompletedFooter: React.FC<ICompletedFooterProps> = ({ result }) => (
    <div className="order-cafe-footer">
        <div className="flex align-center flex-end">
            <span className="material-symbols-outlined">check_circle</span>
            <span>Order #{result.buyOnDemandOrderNumber}</span>
            <span>Ready in {formatWaitTime(result.waitTimeMin, result.waitTimeMax)}</span>
        </div>
    </div>
);
