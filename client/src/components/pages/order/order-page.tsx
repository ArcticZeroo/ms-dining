import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { ICompleteOrderResponse, IPrepareOrderResponse } from '@msdining/common/models/cart';
import { useCallback, useMemo, useRef, useState } from 'react';
import { OrderingClient } from '../../../api/order.ts';
import { DebugSettings } from '../../../constants/settings.ts';
import { CartContext, CartHydrationContext } from '../../../context/cart.ts';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { usePopupCloserAlways, usePopupOpener } from '../../../hooks/popup.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { IPaymentFormData, PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';
import { MultiCafePayment } from '../../order/payment/multi-cafe-payment.tsx';
import { PaymentIframe } from '../../order/payment/payment-iframe.tsx';

import './order-page.css';
import { OrderStatus } from '../../order/status/order-status.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

export const OrderPage = () => {
    const allowOnlineOrdering = useValueNotifier(DebugSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);
    const cartHydrationState = useValueNotifierContext(CartHydrationContext);

    const [orderResult, setOrderResult] = useState<ICompleteOrderResponse | null>(null);
    const [prepareResults, setPrepareResults] = useState<IPrepareOrderResponse | null>(null);

    const formDataRef = useRef<IPaymentFormData | null>(null);

    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();

    const popupId = useMemo(() => Symbol('rguest-payment'), []);

    const handlePaymentError = useCallback((error: string) => {
        console.error('Payment error from iframe:', error);
    }, []);

    const { stage: orderStage, error: orderError, run: runOrder } = useDelayedPromiseState(
        useCallback(async () => {
            const formData = formDataRef.current!;

            try {
                const response = await OrderingClient.prepareOrder(cart, formData);

                const cafeEntries = Object.entries(response);
                if (cafeEntries.length === 0) {
                    throw new Error('No cafes returned from server');
                }

                if (cafeEntries.length === 1) {
                    // Single cafe — open payment popup directly
                    const [cafeId, cafeData] = cafeEntries[0]!;

                    if (!cafeData?.iframeUrl) {
                        throw new Error(`No iframe URL returned for cafe ${cafeId}`);
                    }

                    const combinedResults: ICompleteOrderResponse = {};

                    await new Promise<void>((resolve, reject) => {
                        openPopup({
                            id:   popupId,
                            body: (
                                <PaymentIframe
                                    iframeUrl={cafeData.iframeUrl}
                                    onPaymentComplete={async (result) => {
                                        const completeResult = await OrderingClient.completeOrder({
                                            orderIds:     { [cafeId]: cafeData.orderId },
                                            paymentToken: result.token,
                                            cardInfo:     result.cardInfo,
                                            alias:        formData.alias,
                                        });
                                        Object.assign(combinedResults, completeResult);
                                        resolve();
                                    }}
                                    onPaymentError={handlePaymentError}
                                    onClose={() => reject(new Error('Payment cancelled'))}
                                />
                            ),
                        });
                    });

                    closePopup();
                    setOrderResult(combinedResults);
                    return combinedResults;
                }

                // Multiple cafes — show the payment checklist
                setPrepareResults(response);
                return response;
            } catch (err) {
                closePopup();
                throw err;
            }
        }, [cart, popupId, openPopup, closePopup, handlePaymentError])
    );

    const onFormSubmitted = useCallback((formData: IPaymentFormData) => {
        if (orderStage === PromiseStage.running) {
            return;
        }
        formDataRef.current = formData;
        runOrder();
    }, [orderStage, runOrder]);

    const onAllCafesComplete = useCallback((results: ICompleteOrderResponse) => {
        setPrepareResults(null);
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
                    <button className="default-container" onClick={() => setOrderResult(null)}>
                        Return to Checkout
                    </button>
                </div>
            </>
        );
    }

    if (prepareResults != null) {
        return (
            <div id="order-checkout" className="flex-col">
                <MultiCafePayment
                    prepareResults={prepareResults}
                    alias={formDataRef.current!.alias}
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
            {orderStage === PromiseStage.running && (
                <div className="flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    Preparing your order...
                </div>
            )}
            {orderStage === PromiseStage.error && (
                <div className="card error">
                    {orderError instanceof Error ? orderError.message : 'Failed to prepare order'}
                    <RetryButton onClick={runOrder}/>
                </div>
            )}
            <PaymentInfoForm onSubmit={onFormSubmitted}/>
            <OrderPrivacyPolicy/>
        </div>
    );
};