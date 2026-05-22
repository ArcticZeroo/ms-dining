import type { IActiveOrderSummary, OrderCafePartStatus } from '@msdining/common/models/cart';
import type { ICheckoutResult, ICompleteOrderResult } from '@msdining/common/models/order';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnlineOrderingState } from '../../../hooks/cafe.ts';
import {
    useAbandonRemainingCafesMutation,
    useStartCheckoutMutation,
} from '../../../store/queries/new-ordering.ts';
import { useCartQuery } from '../../../store/queries/server-cart.ts';
import {
    useServerCartActiveOrder,
    useServerCartHasUnavailableItems,
    useServerCartItems,
} from '../../../store/zustand/server-cart.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OnlineOrderingUnavailableNotice } from '../../notice/online-ordering-unavailable-notice.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { MultiCafePayment } from '../../order/payment/multi-cafe-payment.tsx';
import { ICafePaymentRowValue } from '../../order/payment/cafe-payment-row.tsx';
import { IPaymentFormData, PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';
import { IOrderStatusItem, OrderStatus } from '../../order/status/order-status.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

import './order-page.css';

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return fallback;
};

const getDisplayStatus = (
    activeOrderPartStatus: OrderCafePartStatus | undefined,
    completedResult: ICompleteOrderResult | undefined,
): OrderCafePartStatus => {
    if (completedResult != null) {
        return 'completed';
    }

    return activeOrderPartStatus ?? 'payment_pending';
};

const mergeCafeParts = (
    activeOrder: IActiveOrderSummary | undefined,
    checkoutResult: ICheckoutResult | undefined,
    completedResultsByCafeId: Record<string, ICompleteOrderResult>,
): ICafePaymentRowValue[] => {
    const checkoutByCafeId = new Map(checkoutResult?.cafeResults.map(result => [result.cafeId, result]) ?? []);
    const activeOrderByCafeId = new Map(activeOrder?.cafeParts.map(part => [part.cafeId, part]) ?? []);
    const cafeIds = [
        ...(activeOrder?.cafeParts.map(part => part.cafeId) ?? []),
        ...((checkoutResult?.cafeResults ?? []).map(result => result.cafeId)),
    ].filter((cafeId, index, allCafeIds) => allCafeIds.indexOf(cafeId) === index);

    return cafeIds.map((cafeId) => {
        const checkoutCafe = checkoutByCafeId.get(cafeId);
        const activeOrderCafe = activeOrderByCafeId.get(cafeId);
        const completedResult = completedResultsByCafeId[cafeId];

        return {
            cafeId,
            status: getDisplayStatus(activeOrderCafe?.status, completedResult),
            total: activeOrderCafe?.total ?? checkoutCafe?.total ?? null,
            waitTimeMin: completedResult?.waitTimeMin ?? activeOrderCafe?.waitTimeMin ?? checkoutCafe?.waitTimeMin ?? null,
            waitTimeMax: completedResult?.waitTimeMax ?? activeOrderCafe?.waitTimeMax ?? checkoutCafe?.waitTimeMax ?? null,
            buyOnDemandOrderNumber: completedResult?.buyOnDemandOrderNumber ?? activeOrderCafe?.buyOnDemandOrderNumber ?? checkoutCafe?.buyOnDemandOrderNumber ?? null,
        } satisfies ICafePaymentRowValue;
    });
};

const OrderPageBody = () => {
    const cart = useServerCartItems();
    const activeOrder = useServerCartActiveOrder();
    const hasUnavailableItems = useServerCartHasUnavailableItems();
    const cartQuery = useCartQuery();
    const navigate = useNavigate();
    const startCheckout = useStartCheckoutMutation();
    const abandonOrder = useAbandonRemainingCafesMutation();
    const [checkoutResult, setCheckoutResult] = useState<ICheckoutResult>();
    const [checkoutError, setCheckoutError] = useState<string>();
    const [completedResultsByCafeId, setCompletedResultsByCafeId] = useState<Record<string, ICompleteOrderResult>>({});

    const availableItems = useMemo(
        () => cart.filter(item => item.isAvailable),
        [cart],
    );
    const hasAvailableItems = availableItems.length > 0;
    const availableCafeCount = useMemo(
        () => new Set(availableItems.map(item => item.menuItem.cafeId)).size,
        [availableItems],
    );
    const currentOrderId = activeOrder?.orderSessionId ?? checkoutResult?.orderSessionId;
    const cafePayments = useMemo(
        () => mergeCafeParts(activeOrder, checkoutResult, completedResultsByCafeId),
        [activeOrder, checkoutResult, completedResultsByCafeId],
    );
    const completedItems = useMemo<IOrderStatusItem[]>(
        () => cafePayments
            .filter(cafe => cafe.status === 'completed')
            .map((cafe) => ({
                cafeId: cafe.cafeId,
                buyOnDemandOrderNumber: cafe.buyOnDemandOrderNumber,
                waitTimeMin: cafe.waitTimeMin,
                waitTimeMax: cafe.waitTimeMax,
                completedAt: completedResultsByCafeId[cafe.cafeId]?.completedAt,
            })),
        [cafePayments, completedResultsByCafeId],
    );

    const isCheckoutInitiated =
        startCheckout.isPending
        || checkoutResult != null
        || activeOrder != null;
    const isShowingPaymentStep = cafePayments.length > 0 && currentOrderId != null;
    const isShowingCompletion = cafePayments.length > 0 && cafePayments.every(cafe => cafe.status === 'completed');

    const handleStartCheckout = useCallback(async (paymentInfo: IPaymentFormData) => {
        if (startCheckout.isPending) {
            return;
        }

        setCheckoutError(undefined);

        try {
            const result = await startCheckout.mutateAsync(paymentInfo);
            setCheckoutResult(result);
            setCompletedResultsByCafeId({});
        } catch (error) {
            setCheckoutError(getErrorMessage(error, 'Failed to start checkout'));
        }
    }, [startCheckout]);

    const handleCafeCompleted = useCallback((cafeId: string, result: ICompleteOrderResult) => {
        setCompletedResultsByCafeId((current) => ({
            ...current,
            [cafeId]: result,
        }));
    }, []);

    const handleCancelOrder = useCallback(async () => {
        if (currentOrderId == null || abandonOrder.isPending) {
            return;
        }

        try {
            await abandonOrder.mutateAsync(currentOrderId);
            setCheckoutResult(undefined);
            setCheckoutError(undefined);
            setCompletedResultsByCafeId({});
            navigate('/');
        } catch (error) {
            setCheckoutError(getErrorMessage(error, 'Failed to cancel order'));
        }
    }, [abandonOrder, currentOrderId, navigate]);

    if (cartQuery.isPending && activeOrder == null && checkoutResult == null) {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your cart...
            </div>
        );
    }

    if (cartQuery.isError && !isShowingPaymentStep && !isShowingCompletion) {
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

    if (!hasAvailableItems && !hasUnavailableItems && !isShowingPaymentStep && !isShowingCompletion) {
        return <EmptyCartNotice/>;
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            {!isShowingPaymentStep && !isShowingCompletion && (
                <>
                    <div className="card dark-blue">
                        <div className="title">
                            Your Order
                        </div>
                        <CartContentsTable
                            showFullDetails={true}
                            showTotalPrice={true}
                            readOnly={isCheckoutInitiated}
                        />
                    </div>
                    {availableCafeCount > 1 && <MultiCafeOrderWarning/>}
                    <PaymentInfoForm
                        isPrepareStarted={isCheckoutInitiated}
                        isCartReady={hasAvailableItems}
                        onSubmit={(paymentInfo) => void handleStartCheckout(paymentInfo)}
                    />
                    <OrderPrivacyPolicy/>
                    {startCheckout.isPending && (
                        <div className="flex flex-justify-center">
                            <HourglassLoadingSpinner/>
                            Starting checkout...
                        </div>
                    )}
                </>
            )}
            {checkoutError && (
                <div className="card error">
                    {checkoutError}
                </div>
            )}
            {isShowingPaymentStep && currentOrderId && !isShowingCompletion && (
                <>
                    <div className="card dark-blue">
                        <div className="title">Order Summary</div>
                        <WaitTime checkoutResult={checkoutResult} activeOrder={activeOrder}/>
                    </div>
                    <MultiCafePayment
                        orderId={currentOrderId}
                        cafes={cafePayments}
                        isCancelling={abandonOrder.isPending}
                        onCompleted={handleCafeCompleted}
                        onCancelOrder={() => void handleCancelOrder()}
                    />
                </>
            )}
            {isShowingCompletion && (
                <>
                    <OrderStatus items={completedItems}/>
                    <div className="flex flex-justify-center">
                        <button className="default-container" onClick={() => navigate('/')}>
                            Return Home
                        </button>
                    </div>
                </>
            )}
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
