import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { CartContext } from '../../../context/cart.ts';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';

import './order-page.css';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { useCallback } from 'react';
import { OrderingClient } from '../../../api/order.ts';
import { OrderStatus } from '../../order/status/order-status.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { WaitTime } from '../../order/wait-time.tsx';
import { DebugSettings } from '../../../constants/settings.ts';

export const OrderPage = () => {
    const allowOnlineOrdering = useValueNotifier(DebugSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);

    const doOrderCallback = useCallback(
        () => OrderingClient.submitOrder(cart),
        [cart]
    );
    const { stage, run, value, error } = useDelayedPromiseState(doOrderCallback, false /*keepLastValue*/);

    const onFormSubmitted = () => {
        if (stage !== PromiseStage.notRun) {
            return;
        }

        run();
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