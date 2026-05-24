import React from 'react';
import type { PaymentState } from '../../../../../hooks/cafe-payment-flow.tsx';
import { UnhandledDefaultError } from '@msdining/common/util/switch-util';
import { ReadyToPayFooter } from './ready-to-pay-footer.tsx';
import { CompletingFooter } from './completing-footer.tsx';
import { CompletedFooter } from './completed-footer.tsx';

interface IOrderCafeFooterProps {
    paymentState: PaymentState;
    totalQuantity: number;
    totalPrice: number;
    hasUnavailableItems: boolean;
    onPay: () => void;
}

export const OrderCafeFooter: React.FC<IOrderCafeFooterProps> = ({
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
    case 'preparing':
        return <CompletingFooter/>;
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
};
