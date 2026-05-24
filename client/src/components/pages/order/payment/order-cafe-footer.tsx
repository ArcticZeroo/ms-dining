import type { ICompleteOrderResult } from '@msdining/common/models/order';
import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';
import { formatWaitTime } from '../../../../util/order.ts';
import { usePaymentIdentityContext } from '../../../../context/payment-identity.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { RetryButton } from '../../../button/retry-button.tsx';

interface IOrderCafeFooterProps {
    completionResult: ICompleteOrderResult | undefined;
    totalQuantity: number;
    totalPrice: number;
    isBusy: boolean;
    isCompleting: boolean;
    hasUnavailableItems: boolean;
    notice: string | undefined;
    onPay: () => void;
    onRetryCompletion: () => void;
}

const getPayButtonTitle = (isIdentityValid: boolean, isBusy: boolean, hasUnavailableItems: boolean) => {
    if (hasUnavailableItems) {
        return 'Remove all unavailable items from your cart before paying.';
    }

    if (isBusy) {
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
    isBusy,
    isCompleting,
    hasUnavailableItems,
    notice,
    onPay,
    onRetryCompletion,
}) => {
    const { isValid: isIdentityValid } = usePaymentIdentityContext();

    if (completionResult != null) {
        return (
            <div className="order-cafe-footer">
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

    if (isCompleting) {
        return (
            <div className="order-cafe-footer">
                <div className="flex align-center flex-justify-center">
                    <HourglassLoadingSpinner/>
                    <span>Finishing your order...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="order-cafe-footer">
            {
                notice && (
                    <div className="order-cafe-notice">
                        <span>{notice}</span>
                        {
                            onRetryCompletion && (
                                <RetryButton onClick={onRetryCompletion}/>
                            )
                        }
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
                    disabled={!isIdentityValid || isBusy || hasUnavailableItems}
                    onClick={onPay}
                    title={getPayButtonTitle(isIdentityValid, isBusy, hasUnavailableItems)}
                >
                    Pay {formatPrice(totalPrice)}
                </button>
            </div>
        </div>
    );
};
