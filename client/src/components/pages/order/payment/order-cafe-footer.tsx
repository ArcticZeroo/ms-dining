import type { ICompleteOrderResult } from '@msdining/common/models/order';
import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';
import { formatWaitTime } from '../../../../util/order.ts';

interface IOrderCafeFooterProps {
    completionResult: ICompleteOrderResult | undefined;
    totalQuantity: number;
    totalPrice: number;
    isPayEnabled: boolean;
    isLocalBusy: boolean;
    hasUnavailableItems: boolean;
    onPay: () => void;
}

export const OrderCafeFooter: React.FC<IOrderCafeFooterProps> = ({
    completionResult,
    totalQuantity,
    totalPrice,
    isPayEnabled,
    isLocalBusy,
    hasUnavailableItems,
    onPay,
}) => {
    if (completionResult != null) {
        return (
            <div className="order-page-cafe-footer">
                <div className="flex align-center flex-end">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                        Order #{completionResult.buyOnDemandOrderNumber}
                    </span>
                    <span>
                        Ready in {formatWaitTime(completionResult.waitTimeMin, completionResult.waitTimeMax)}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="order-page-cafe-footer">
            <span>{totalQuantity} item{totalQuantity === 1 ? '' : 's'}</span>
            <button
                className="default-container"
                disabled={!isPayEnabled || isLocalBusy || hasUnavailableItems}
                onClick={onPay}
            >
                Pay {formatPrice(totalPrice)}
            </button>
        </div>
    );
};
