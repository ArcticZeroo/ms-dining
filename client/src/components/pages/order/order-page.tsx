import { PromiseStage, useMaybeExistingPromiseState } from '@arcticzeroo/react-promise-hook';
import { IOrderCompletionResponse } from '@msdining/common/dist/models/cart';
import { useState } from 'react';
import { OrderingClient } from '../../../api/order.ts';
import { DebugSettings } from '../../../constants/settings.ts';
import { CartContext, CartHydrationContext } from '../../../context/cart.ts';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { IPaymentInfo, PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';

import './order-page.css';
import { OrderStatus } from '../../order/status/order-status.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

export const OrderPage = () => {
    const allowOnlineOrdering = useValueNotifier(DebugSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);
    const cartHydrationState = useValueNotifierContext(CartHydrationContext);

    const [orderPromise, setOrderPromise] = useState<Promise<IOrderCompletionResponse> | undefined>(undefined);
    const { stage: orderSubmitStage, value: orderSubmitResult, error: orderSubmitError } = useMaybeExistingPromiseState(orderPromise);

    const onFormSubmitted = (paymentInfo: IPaymentInfo) => {
        if (orderSubmitStage !== PromiseStage.notRun) {
            return;
        }

        setOrderPromise(OrderingClient.submitOrder(cart, paymentInfo));
    };

    if (orderSubmitStage === PromiseStage.notRun) {
        if (cartHydrationState.stage === PromiseStage.running) {
            return (
                <div className="flex">
                    <HourglassLoadingSpinner/>
                    Loading your saved cart...
                </div>
            );
        }

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
                    <CartContentsTable showFullDetails={true} showTotalPrice={true}/>
                    <WaitTime/>
                </div>
                {cart.size > 1 && <MultiCafeOrderWarning/>}
                <PaymentInfoForm onSubmit={onFormSubmitted}/>
                <OrderPrivacyPolicy/>
            </div>
        );
    } else {
        return (
            <>
                <OrderStatus
                    stage={orderSubmitStage}
                    value={orderSubmitResult}
                    error={orderSubmitError}
                />
                {
                    orderSubmitStage !== PromiseStage.running && (
                        <div className="flex flex-center">
                            <button className="default-container" onClick={() => setOrderPromise(undefined)}>
                                Return to Checkout
                            </button>
                        </div>
                    )
                }
            </>
        )
    }
};