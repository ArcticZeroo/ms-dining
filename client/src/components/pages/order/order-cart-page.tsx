import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOrderGuard } from '../../../hooks/order-guard.ts';
import { CART_QUERY_KEY, useCartQuery } from '../../../store/queries/server-cart.ts';
import { useStartCheckoutMutation } from '../../../store/queries/new-ordering.ts';
import {
    useServerCartHasUnavailableItems,
    useServerCartItems,
} from '../../../store/zustand/server-cart.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { PaymentInfoForm, type IPaymentFormData } from '../../order/payment/payment-info-form.tsx';

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return fallback;
};

export const OrderCartPage = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const guard = useOrderGuard();
    const cartQuery = useCartQuery();
    const startCheckoutMutation = useStartCheckoutMutation();
    const cartItems = useServerCartItems();
    const hasUnavailableItems = useServerCartHasUnavailableItems();
    const [checkoutError, setCheckoutError] = useState<string>();

    useEffect(() => {
        if (guard.expectedPath != null && guard.expectedPath !== location.pathname) {
            navigate(guard.expectedPath, { replace: true });
        }
    }, [guard.expectedPath, location.pathname, navigate]);

    const availableItems = useMemo(() => cartItems.filter(item => item.isAvailable), [cartItems]);
    const hasAvailableItems = availableItems.length > 0;
    const availableCafeCount = useMemo(
        () => new Set(availableItems.map(item => item.menuItem.cafeId)).size,
        [availableItems],
    );

    const startCheckout = useCallback(async (paymentInfo: IPaymentFormData) => {
        if (startCheckoutMutation.isPending) {
            return;
        }

        setCheckoutError(undefined);

        try {
            const result = await startCheckoutMutation.mutateAsync(paymentInfo);
            await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
            navigate(`/order/${result.orderSessionId}/pay`);
        } catch (error) {
            setCheckoutError(getErrorMessage(error, 'Failed to start checkout'));
        }
    }, [navigate, queryClient, startCheckoutMutation]);

    if (guard.isLoading) {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your cart...
            </div>
        );
    }

    if (cartQuery.isError) {
        return (
            <div id="order-checkout" className="flex-col">
                <OnlineOrderingExperimental/>
                <div className="card error">
                    {getErrorMessage(cartQuery.error, 'Failed to load your cart.')}
                    <RetryButton onClick={() => void cartQuery.refetch()}/>
                </div>
            </div>
        );
    }

    if (!hasAvailableItems && !hasUnavailableItems) {
        return <EmptyCartNotice/>;
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <div className="card dark-blue">
                <div className="title">Your Order</div>
                <CartContentsTable
                    showFullDetails={true}
                    showTotalPrice={true}
                    readOnly={startCheckoutMutation.isPending}
                />
            </div>
            {availableCafeCount > 1 && <MultiCafeOrderWarning/>}
            <PaymentInfoForm
                isPrepareStarted={startCheckoutMutation.isPending}
                isCartReady={hasAvailableItems}
                onSubmit={startCheckout}
                submitLabel="Start Checkout"
            />
            <OrderPrivacyPolicy/>
            {startCheckoutMutation.isPending && (
                <div className="flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    Starting checkout...
                </div>
            )}
            {checkoutError && (
                <div className="card error">
                    {checkoutError}
                </div>
            )}
        </div>
    );
};
