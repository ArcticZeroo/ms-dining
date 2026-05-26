import React from 'react';
import { formatPrice } from '../../../../../util/cart.ts';
import { usePaymentIdentityContext } from '../../../../../context/payment-identity.ts';
import { pluralize } from '../../../../../util/string.ts';

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
    const { isValid: isIdentityValid } = usePaymentIdentityContext();

    return (
        <div className="flex-col">
            <div className="flex flex-between">
                <span>{totalQuantity} {pluralize('item', totalQuantity)}</span>
                <button
                    className="default-container"
                    disabled={!isIdentityValid || hasUnavailableItems}
                    onClick={onPay}
                    title={getPayButtonTitle(isIdentityValid, hasUnavailableItems)}
                >
                    Pay {formatPrice(totalPrice)}
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
