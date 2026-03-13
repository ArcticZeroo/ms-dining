import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { IOrderCompletionResponse } from '@msdining/common/models/cart';
import { useCallback, useEffect, useRef, useState } from 'react';
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

    // Phase 1: Build cart on server + get price data (runs on cart change)
    const {
        stage: cartSessionStage,
        value: cartSessionData,
        error: cartSessionError,
        run: runCartSession
    } = useDelayedPromiseState(
        useCallback(async () => {
            if (cart.size === 0) {
                return null;
            }
            return await OrderingClient.prepareCart(cart);
        }, [cart])
    );

    useEffect(() => {
        runCartSession();
    }, [runCartSession]);

    // Phase 2: Get card processor token (runs when user clicks "Pay with Card")
    const {
        stage: paymentStage,
        value: paymentResults,
        error: paymentError,
        run: runPayment
    } = useDelayedPromiseState(
        useCallback(async () => {
            if (!cartSessionData) {
                throw new Error('Cart session not ready');
            }

            const results: Record<string, { siteToken: string; iframeUrl: string; orderId: string; orderNumber: string; expiresAt: string }> = {};

            await Promise.all(
                Object.entries(cartSessionData).map(async ([cafeId, cafeData]) => {
                    results[cafeId] = await OrderingClient.preparePayment(cafeData.orderId);
                })
            );

            return results;
        }, [cartSessionData])
    );

    const onFormSubmitted = useCallback((formData: IPaymentFormData) => {
        if (paymentStage === PromiseStage.running) {
            return;
        }
        formDataRef.current = formData;
        runPayment();
    }, [paymentStage, runPayment]);

    const onAllCafesComplete = useCallback((results: IOrderCompletionResponse) => {
        setOrderResult(results);
    }, []);

    if (cartHydrationState.stage === PromiseStage.running) {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your saved cart...
            </div>
        );
    }

    const isPaymentStarted = paymentStage !== PromiseStage.notRun;
    const isPaymentComplete = paymentResults != null;

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
                <CartContentsTable
                    showFullDetails={true}
                    showTotalPrice={true}
                    readOnly={isPaymentStarted}
                    cartSessionData={cartSessionData}
                    cartSessionError={cartSessionError}
                />
                <WaitTime cartSessionData={cartSessionData}/>
            </div>
            {cart.size > 1 && <MultiCafeOrderWarning/>}
            <PaymentInfoForm
                isPrepareStarted={isPaymentStarted}
                isCartReady={cartSessionData != null}
                onSubmit={onFormSubmitted}
            />
            <OrderPrivacyPolicy/>
            {cartSessionStage === PromiseStage.running && (
                <div className="flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    Building your order...
                </div>
            )}
            {paymentStage === PromiseStage.running && (
                <div className="flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    Preparing payment...
                </div>
            )}
            {paymentStage === PromiseStage.error && (
                <div className="card error">
                    {paymentError instanceof Error ? paymentError.message : 'Failed to prepare payment'}
                    <RetryButton onClick={runPayment}/>
                </div>
            )}
            {
                isPaymentComplete && (
                    <CafePayment
                        prepareResults={paymentResults}
                        formData={formDataRef.current!}
                        onAllComplete={onAllCafesComplete}
                    />
                )
            }
            {
                orderResult != null && (
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
                )
            }
        </div>
    );
};