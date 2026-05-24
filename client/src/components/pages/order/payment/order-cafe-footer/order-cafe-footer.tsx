import React from 'react';
import type { PaymentState } from '../../../../../hooks/cafe-payment-flow.tsx';
import { UnhandledDefaultError } from '@msdining/common/util/switch-util';
import { ReadyToPayFooter } from './ready-to-pay-footer.tsx';
import { LoadingFooter } from './loading-footer.tsx';
import { CompletedFooter } from './completed-footer.tsx';

interface IOrderCafeFooterProps {
    paymentState: PaymentState;
    totalQuantity: number;
    totalPrice: number;
    hasUnavailableItems: boolean;
    onPay: () => void;
}

const OrderCafeFooterChild: React.FC<IOrderCafeFooterProps> = ({
    paymentState,
    totalQuantity,
    totalPrice,
    hasUnavailableItems,
    onPay,
}) => {
    switch (paymentState.status) {
    case 'completed':
        return <CompletedFooter result={paymentState.result}/>;
    case 'completing':
        return <LoadingFooter message="Sending your order to the kitchen..."/>;
    case 'preparing':
        return <LoadingFooter message="Preparing your payment..."/>;
    case 'ready-to-pay':
        return (
            <ReadyToPayFooter
                notice={paymentState.notice}
                totalQuantity={totalQuantity}
                totalPrice={totalPrice}
                hasUnavailableItems={hasUnavailableItems}
                onPay={onPay}
            />
        );
    default:
        throw new UnhandledDefaultError(paymentState);
    }
}

export const OrderCafeFooter: React.FC<IOrderCafeFooterProps> = ({
    paymentState,
    totalQuantity,
    totalPrice,
    hasUnavailableItems,
    onPay,
}) => {
    return (
        <div className="order-cafe-footer flex-col">
            <OrderCafeFooterChild
                paymentState={paymentState}
                totalQuantity={totalQuantity}
                totalPrice={totalPrice}
                hasUnavailableItems={hasUnavailableItems}
                onPay={onPay}
            />
        </div>
    );
};
