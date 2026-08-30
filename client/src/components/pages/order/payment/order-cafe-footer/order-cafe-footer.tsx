import React from 'react';
import type { PaymentState } from '../../../../../hooks/cafe-payment-flow.tsx';
import type { IPayAvailability } from '../../../../../util/pay-availability.ts';
import { UnhandledDefaultError } from '@msdining/common/util/switch-util';
import { ReadyToPayFooter } from './ready-to-pay-footer.tsx';
import { LoadingFooter } from './loading-footer.tsx';
import { CompletedFooter } from './completed-footer.tsx';

interface IOrderCafeFooterProps {
    paymentState: PaymentState;
    payAvailability: IPayAvailability;
    totalQuantity: number;
    totalPrice: number;
    hasUnavailableItems: boolean;
    onPay: () => void;
}

const OrderCafeFooterChild: React.FC<IOrderCafeFooterProps> = ({
    paymentState,
    payAvailability,
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
                payAvailability={payAvailability}
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

// eslint-disable-next-line react/no-multi-comp -- OrderCafeFooterChild is the co-located status dispatcher for this footer
export const OrderCafeFooter: React.FC<IOrderCafeFooterProps> = ({
    paymentState,
    payAvailability,
    totalQuantity,
    totalPrice,
    hasUnavailableItems,
    onPay,
}) => {
    return (
        <div className="order-cafe-footer flex-col">
            <OrderCafeFooterChild
                paymentState={paymentState}
                payAvailability={payAvailability}
                totalQuantity={totalQuantity}
                totalPrice={totalPrice}
                hasUnavailableItems={hasUnavailableItems}
                onPay={onPay}
            />
        </div>
    );
};
