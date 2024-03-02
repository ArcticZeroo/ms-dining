import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { CartContext } from '../../../context/cart.ts';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { IPaymentInfo, PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';

import './order-page.css';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { PromiseStage, useMaybeExistingPromiseState } from '@arcticzeroo/react-promise-hook';
import { useState } from 'react';
import { OrderingClient } from '../../../api/order.ts';
import { OrderStatus } from '../../order/status/order-status.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { WaitTime } from '../../order/wait-time.tsx';
import { DebugSettings } from '../../../constants/settings.ts';
import { IOrderCompletionResponse } from '@msdining/common/dist/models/cart';

export const OrderPage = () => {
    const allowOnlineOrdering = useValueNotifier(DebugSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);

    const [orderPromise, setOrderPromise] = useState<Promise<IOrderCompletionResponse> | undefined>(undefined);
    const { stage, value, error } = useMaybeExistingPromiseState(orderPromise);

    const onFormSubmitted = (paymentInfo: IPaymentInfo) => {
        if (stage !== PromiseStage.notRun) {
            return;
        }

        setOrderPromise(OrderingClient.submitOrder(cart, paymentInfo));
    };

    if (stage === PromiseStage.notRun) {
        const isCheckoutAllowed = allowOnlineOrdering && cart.size > 0;

        if (!isCheckoutAllowed) {
            return <EmptyCartNotice/>;
        }

        return (
            <div id="order-checkout" className="flex-col">
                <OnlineOrderingExperimental/>
                <div className="card dark-blue">
                    <div className="title">
                        Your Order
                    </div>
                    <CartContentsTable showModifiers={true} showTotalPrice={true}/>
                    <WaitTime/>
                </div>
                {cart.size > 1 && <MultiCafeOrderWarning/>}
                <PaymentInfoForm onSubmit={onFormSubmitted}/>
                <OrderPrivacyPolicy/>
            </div>
        );
    } else {
        return <OrderStatus
            stage={stage}
            value={value}
            error={error}
        />
    }
};