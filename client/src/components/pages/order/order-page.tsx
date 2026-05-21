import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnlineOrderingState } from '../../../hooks/cafe.ts';
import { useCartQuery } from '../../../store/queries/server-cart.ts';
import { usePrepareAllPaymentsMutation, useCartSessionQuery } from '../../../store/queries/ordering.ts';
import {
    useServerCartHasUnavailableItems,
    useServerCartItems,
} from '../../../store/zustand/server-cart.ts';
import { useAllCafesComplete, useCompletionResults, useOrderingStore } from '../../../store/zustand/ordering.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OnlineOrderingUnavailableNotice } from '../../notice/online-ordering-unavailable-notice.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { CartHydrationView } from '../../order/cart/cart-hydration-view.tsx';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { IPaymentFormData, PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';
import { CafePayment } from '../../order/payment/multi-cafe-payment.tsx';
import { OrderStatus } from '../../order/status/order-status.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

import './order-page.css';

const OrderPageBody = () => {
    const cart = useServerCartItems();
    const hasUnavailableItems = useServerCartHasUnavailableItems();
    const cartQuery = useCartQuery();
    const navigate = useNavigate();

    const cartSessionQuery = useCartSessionQuery();
    const prepareAllPayments = usePrepareAllPaymentsMutation();
    const formData = useOrderingStore((state) => state.formData);
    const allCafesComplete = useAllCafesComplete();
    const completionResults = useCompletionResults();

    const availableCafeCount = useMemo(
        () => new Set(cart.filter(item => item.isAvailable).map(item => item.menuItem.cafeId)).size,
        [cart],
    );

    // Clear any prior in-progress / completed checkout state on mount so a fresh
    // visit to /order doesn't show stale "paid" badges.
    useEffect(() => {
        useOrderingStore.getState().reset();
    }, []);

    if (cartQuery.isPending) {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your cart...
            </div>
        );
    }

    const isPaymentStarted = formData != null;
    const isCheckoutAllowed = availableCafeCount > 0;

    // Show the completion view even after the cart has been emptied (each
    // successful cafe payment removes that cafe from the cart, so the very last
    // completion takes us to size === 0). Without this guard, the empty-cart
    // notice would briefly replace the receipt UI.
    const isShowingCompletion = isPaymentStarted && allCafesComplete;

    if (!isCheckoutAllowed && !hasUnavailableItems && !isShowingCompletion) {
        return <EmptyCartNotice/>;
    }

    const onFormSubmitted = (submittedFormData: IPaymentFormData) => {
        if (prepareAllPayments.isPending) {
            return;
        }
        prepareAllPayments.mutate(submittedFormData);
    };

    const isShowingActiveCheckout = isCheckoutAllowed && !isShowingCompletion;

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <CartHydrationView/>
            {
                isShowingActiveCheckout && (
                    <>
                        <div className="card dark-blue">
                            <div className="title">
                                Your Order
                            </div>
                            <CartContentsTable
                                showFullDetails={true}
                                showTotalPrice={true}
                                readOnly={isPaymentStarted}
                            />
                            <WaitTime/>
                        </div>
                        {availableCafeCount > 1 && <MultiCafeOrderWarning/>}
                        <PaymentInfoForm
                            isPrepareStarted={isPaymentStarted}
                            isCartReady={cartSessionQuery.data != null}
                            onSubmit={onFormSubmitted}
                        />
                        <OrderPrivacyPolicy/>
                        {cartSessionQuery.isFetching && (
                            <div className="flex flex-justify-center">
                                <HourglassLoadingSpinner/>
                                Building your order...
                            </div>
                        )}
                        {(!cartSessionQuery.isFetching && prepareAllPayments.isPending) && (
                            <div className="flex flex-justify-center">
                                <HourglassLoadingSpinner/>
                                Preparing payment...
                            </div>
                        )}
                        {prepareAllPayments.isError && (
                            <div className="card error">
                                {prepareAllPayments.error instanceof Error ? prepareAllPayments.error.message : 'Failed to prepare payment'}
                                <RetryButton onClick={() => formData && prepareAllPayments.mutate(formData)}/>
                            </div>
                        )}
                        {
                            isPaymentStarted && !allCafesComplete && (
                                <CafePayment formData={formData}/>
                            )
                        }
                    </>
                )
            }
            {
                isShowingCompletion && (
                    <>
                        <OrderStatus value={completionResults}/>
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

export const OrderPage = () => {
    const orderingState = useOnlineOrderingState();

    if (!orderingState.allowed) {
        return <OnlineOrderingUnavailableNotice state={orderingState}/>;
    }

    return <OrderPageBody/>;
};
