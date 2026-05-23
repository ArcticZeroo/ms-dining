import type { ICompleteOrderResult } from '@msdining/common/models/order';
import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';
import { formatWaitTime } from '../../../../util/order.ts';
import { usePaymentIdentityContext } from '../../../../context/payment-identity.ts';

interface IOrderCafeFooterProps {
    completionResult: ICompleteOrderResult | undefined;
    totalQuantity: number;
    totalPrice: number;
    isLocalBusy: boolean;
    hasUnavailableItems: boolean;
    onPay: () => void;
}

const getPayButtonTitle = (isIdentityValid: boolean, isLocalBusy: boolean, hasUnavailableItems: boolean) => {
    if (hasUnavailableItems) {
        return 'Remove all unavailable items from your cart before paying.';
    }

    if (isLocalBusy) {
        return 'Updating your cart, please wait...';
    }

    if (!isIdentityValid) {
        return 'Please enter valid phone number/alias before paying.';
    }

    return 'Click to open payment popup';
}

export const OrderCafeFooter: React.FC<IOrderCafeFooterProps> = ({
    completionResult,
    totalQuantity,
    totalPrice,
    isLocalBusy,
    hasUnavailableItems,
    onPay,
}) => {
    const { isValid: isIdentityValid } = usePaymentIdentityContext();
    if (completionResult != null) {
        return (
            <div className="flex align-center flex-end">
                <span className="material-symbols-outlined">check_circle</span>
                <span>
                    Order #{completionResult.buyOnDemandOrderNumber}
                </span>
                <span>
                    Ready in {formatWaitTime(completionResult.waitTimeMin, completionResult.waitTimeMax)}
                </span>
            </div>
        );
    }

    return (
        <div className="flex flex-between">
            <span>{totalQuantity} item{totalQuantity === 1 ? '' : 's'}</span>
            <button
                className="default-container"
                disabled={!isIdentityValid || isLocalBusy || hasUnavailableItems}
                onClick={onPay}
                title={getPayButtonTitle(isIdentityValid, isLocalBusy, hasUnavailableItems)}
            >
                Pay {formatPrice(totalPrice)}
            </button>
        </div>
    );
};
