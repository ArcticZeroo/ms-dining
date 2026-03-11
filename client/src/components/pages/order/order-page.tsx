import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { IOrderCompletionResponse } from '@msdining/common/models/cart';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrderingClient } from '../../../api/order.ts';
import { DebugSettings } from '../../../constants/settings.ts';
import { CartContext, CartHydrationContext } from '../../../context/cart.ts';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { IPaymentFormData, PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';
import { CafePayment } from '../../order/payment/multi-cafe-payment.tsx';

import './order-page.css';
import { OrderStatus } from '../../order/status/order-status.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

export const OrderPage = () => {
    const allowOnlineOrdering = useValueNotifier(DebugSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);
    const cartHydrationState = useValueNotifierContext(CartHydrationContext);
    const navigate = useNavigate();

    const [orderResult, setOrderResult] = useState<IOrderCompletionResponse | null>(null);

    const formDataRef = useRef<IPaymentFormData | null>(null);

    const { stage: prepareStage, value: prepareResults, error: prepareError, run: runPrepare } = useDelayedPromiseState(
        useCallback(async () => {
            const formData = formDataRef.current!;

            const response = await OrderingClient.prepareOrder(cart, formData);

            const cafeEntries = Object.entries(response);
            if (cafeEntries.length === 0) {
                throw new Error('No cafes returned from server');
            }

            return response;
        }, [cart])
    );

    const onFormSubmitted = useCallback((formData: IPaymentFormData) => {
        if (prepareStage === PromiseStage.running) {
            return;
        }
        formDataRef.current = formData;
        runPrepare();
    }, [prepareStage, runPrepare]);

    const onAllCafesComplete = useCallback((results: IOrderCompletionResponse) => {
        setOrderResult(results);
    }, []);

    if (orderResult != null) {
        return (
            <>
                <OrderStatus
                    stage={PromiseStage.success}
                    value={orderResult}
                    error={undefined}
                />
                <div className="flex flex-justify-center">
                    <button className="default-container" onClick={() => navigate('/')}>
                        Return Home
                    </button>
                </div>
            </>
        );
    }

    if (prepareResults != null) {
        return (
            <div id="order-checkout" className="flex-col">
                <CafePayment
                    prepareResults={prepareResults}
                    formData={formDataRef.current!}
                    onAllComplete={onAllCafesComplete}
                />
            </div>
        );
    }

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
            {prepareStage === PromiseStage.running && (
                <div className="flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    Preparing your order...
                </div>
            )}
            {prepareStage === PromiseStage.error && (
                <div className="card error">
                    {prepareError instanceof Error ? prepareError.message : 'Failed to prepare order'}
                    <RetryButton onClick={runPrepare}/>
                </div>
            )}
            <PaymentInfoForm onSubmit={onFormSubmitted}/>
            <OrderPrivacyPolicy/>
        </div>
    );
};