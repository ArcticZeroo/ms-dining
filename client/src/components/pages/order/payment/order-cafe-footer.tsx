import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';
import { formatWaitTime } from '../../../../util/order.ts';
import { usePaymentIdentityContext } from '../../../../context/payment-identity.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import type { PaymentState } from '../../../../hooks/cafe-payment-flow.tsx';

interface IOrderCafeFooterProps {
    paymentState: PaymentState;
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

const ReadyFooter: React.FC<{
    notice?: string;
    totalQuantity: number;
    totalPrice: number;
    hasUnavailableItems: boolean;
    onPay: () => void;
}> = ({ notice, totalQuantity, totalPrice, hasUnavailableItems, onPay }) => {
    const { isValid: isIdentityValid } = usePaymentIdentityContext();

    return (
        <div className="order-cafe-footer">
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
            <div className="flex flex-between">
                <span>{totalQuantity} item{totalQuantity === 1 ? '' : 's'}</span>
                <button
                    className="default-container"
                    disabled={!isIdentityValid || hasUnavailableItems}
                    onClick={onPay}
                    title={getPayButtonTitle(isIdentityValid, hasUnavailableItems)}
                >
                    Pay {formatPrice(totalPrice)}
                </button>
            </div>
        </div>
    );
};

const CompletingFooter: React.FC = () => (
    <div className="order-cafe-footer">
        <div className="flex align-center flex-justify-center">
            <HourglassLoadingSpinner/>
            <span>Finishing your order...</span>
        </div>
    </div>
);

const CompletedFooter: React.FC<{ result: PaymentState & { status: 'completed' } }> = ({ result }) => (
    <div className="order-cafe-footer">
        <div className="flex align-center flex-end">
            <span className="material-symbols-outlined">check_circle</span>
            <span>Order #{result.result.buyOnDemandOrderNumber}</span>
            <span>Ready in {formatWaitTime(result.result.waitTimeMin, result.result.waitTimeMax)}</span>
        </div>
    </div>
);

export const OrderCafeFooter: React.FC<IOrderCafeFooterProps> = ({
    paymentState,
    totalQuantity,
    totalPrice,
    hasUnavailableItems,
    onPay,
}) => {
    switch (paymentState.status) {
    case 'completed':
        return <CompletedFooter result={paymentState}/>;
    case 'completing':
    case 'preparing':
        return <CompletingFooter/>;
    case 'ready':
        return (
            <ReadyFooter
                notice={paymentState.notice}
                totalQuantity={totalQuantity}
                totalPrice={totalPrice}
                hasUnavailableItems={hasUnavailableItems}
                onPay={onPay}
            />
        );
    default: {
        const exhaustive: never = paymentState;
        throw new Error(`Unhandled payment state: ${(exhaustive as PaymentState).status}`);
    }
    }
};
