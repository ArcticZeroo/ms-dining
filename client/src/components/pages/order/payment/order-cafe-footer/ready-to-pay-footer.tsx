import React, { useContext } from 'react';
import { formatPrice } from '../../../../../util/cart.ts';
import type { IPayAvailability, PayBlockReason } from '../../../../../util/pay-availability.ts';
import { pluralize } from '../../../../../util/string.ts';
import { useCartEstimateQuery } from '../../../../../store/queries/ordering.ts';
import { WaitTimeEstimateBanner } from '../wait-time-estimate.js';
import { CurrentCafeContext } from '../../../../../context/menu-item.js';

interface IReadyToPayFooterProps {
    notice?: string;
    payAvailability: IPayAvailability;
    totalQuantity: number;
    totalPrice: number;
    hasUnavailableItems: boolean;
    onPay: () => void;
}

const getPayButtonTitle = (blockReason: PayBlockReason | null) => {
    switch (blockReason) {
    case 'unavailable-items':
        return 'Remove all unavailable items from your cart before paying.';
    case 'invalid-identity':
        return 'Please enter valid phone number/alias before paying.';
    case 'other-payment-active':
        return 'Finish paying for the other cafe before starting this one.';
    default:
        return 'Click to open payment popup';
    }
}

export const ReadyToPayFooter: React.FC<IReadyToPayFooterProps> = ({ notice, payAvailability, totalQuantity, totalPrice, hasUnavailableItems, onPay }) => {
    const cafe = useContext(CurrentCafeContext);
    const { data: estimate, isPlaceholderData } = useCartEstimateQuery(cafe.id, hasUnavailableItems);

    // Only trust the server total when it's freshly loaded for the current cart.
    // While it's still loading (or showing kept-previous data after a cart change),
    // show the local subtotal plus a "+ tax" hint rather than a stale total.
    const hasFreshServerTotal = estimate != null && estimate.total > 0 && !isPlaceholderData;

    return (
        <div className="flex-col">
            <div className="flex flex-between">
                <span>{totalQuantity} {pluralize('item', totalQuantity)}</span>
                <WaitTimeEstimateBanner waitTime={estimate?.waitTime}/>
                <button
                    className="default-container default-button"
                    disabled={!payAvailability.canPay}
                    onClick={onPay}
                    title={getPayButtonTitle(payAvailability.blockReason)}
                >
                    {
                        hasFreshServerTotal
                            ? `Pay ${formatPrice(estimate!.total)}`
                            : `Pay ${formatPrice(totalPrice)} + tax`
                    }
                </button>
            </div>
            {
                notice && (
                    <div className="order-cafe-notice">
                        <span>{notice}</span>
                    </div>
                )
            }
            {
                hasUnavailableItems && (
                    <div className="order-cafe-notice">
                        Remove unavailable items from your cart before paying this cafe.
                    </div>
                )
            }
        </div>
    );
};
