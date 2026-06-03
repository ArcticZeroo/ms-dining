import React, { useContext } from 'react';
import { formatPrice } from '../../../../../util/cart.ts';
import { usePaymentIdentityContext } from '../../../../../context/payment-identity.ts';
import { pluralize } from '../../../../../util/string.ts';
import { useCartEstimateQuery } from '../../../../../store/queries/ordering.ts';
import { WaitTimeEstimateBanner } from '../wait-time-estimate.js';
import { CurrentCafeContext } from '../../../../../context/menu-item.js';

interface IReadyToPayFooterProps {
    notice?: string;
    totalQuantity: number;
    totalPrice: number;
    hasUnavailableItems: boolean;
    onPay: () => void;
}

const getPayButtonTitle = (isIdentityValid: boolean, hasUnavailableItems: boolean) => {
    if (hasUnavailableItems) {
        return 'Remove all unavailable items from your cart before paying.';
    }

    if (!isIdentityValid) {
        return 'Please enter valid phone number/alias before paying.';
    }

    return 'Click to open payment popup';
}

export const ReadyToPayFooter: React.FC<IReadyToPayFooterProps> = ({ notice, totalQuantity, totalPrice, hasUnavailableItems, onPay }) => {
    const cafe = useContext(CurrentCafeContext);
    const { isValid: isIdentityValid } = usePaymentIdentityContext();
    const { data: estimate } = useCartEstimateQuery(cafe.id);

    const displayPrice = estimate && estimate.total > 0
        ? estimate.total
        : totalPrice;

    return (
        <div className="flex-col">
            <div className="flex flex-between">
                <span>{totalQuantity} {pluralize('item', totalQuantity)}</span>
                <WaitTimeEstimateBanner waitTime={estimate?.waitTime}/>
                <button
                    className="default-container default-button"
                    disabled={!isIdentityValid || hasUnavailableItems}
                    onClick={onPay}
                    title={getPayButtonTitle(isIdentityValid, hasUnavailableItems)}
                >
                    Pay {formatPrice(displayPrice)}
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
