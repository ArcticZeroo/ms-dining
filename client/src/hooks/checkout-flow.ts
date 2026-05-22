import type { IActiveOrderSummary, OrderCafePartStatus } from '@msdining/common/models/cart';
import type { IStartCheckoutResult, ICompleteOrderResult } from '@msdining/common/models/order';
import { useCallback, useMemo, useState } from 'react';
import {
    useAbandonRemainingCafesMutation,
    useStartCheckoutMutation,
} from '../store/queries/new-ordering.ts';
import {
    useServerCartActiveOrder,
    useServerCartHasUnavailableItems,
    useServerCartItems,
} from '../store/zustand/server-cart.ts';
import { useCartQuery } from '../store/queries/server-cart.ts';
import type { ICafePaymentRowValue } from '../components/order/payment/cafe-payment-row.tsx';
import type { IOrderStatusItem } from '../components/order/status/order-status.tsx';
import type { IPaymentFormData } from '../components/order/payment/payment-info-form.tsx';

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
    checkoutResult: IStartCheckoutResult | undefined,
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
            status:                 getDisplayStatus(activeOrderCafe?.status, completedResult),
            total:                  activeOrderCafe?.total ?? checkoutCafe?.total ?? null,
            waitTimeMin:            completedResult?.waitTimeMin ?? activeOrderCafe?.waitTimeMin ?? checkoutCafe?.waitTimeMin ?? null,
            waitTimeMax:            completedResult?.waitTimeMax ?? activeOrderCafe?.waitTimeMax ?? checkoutCafe?.waitTimeMax ?? null,
            buyOnDemandOrderNumber: completedResult?.buyOnDemandOrderNumber ?? activeOrderCafe?.buyOnDemandOrderNumber ?? checkoutCafe?.buyOnDemandOrderNumber ?? null,
        } satisfies ICafePaymentRowValue;
    });
};

export type CheckoutPhase = 'loading' | 'cart-error' | 'empty' | 'pre-checkout' | 'payment' | 'completed';

export interface ICheckoutFlowState {
    phase: CheckoutPhase;

    // Cart
    hasAvailableItems: boolean;
    hasUnavailableItems: boolean;
    availableCafeCount: number;

    // Checkout state
    checkoutResult: IStartCheckoutResult | undefined;
    activeOrder: IActiveOrderSummary | undefined;
    currentOrderId: string | undefined;
    isCheckoutInitiated: boolean;
    isCheckoutPending: boolean;

    // Per-cafe payment data
    cafePayments: ICafePaymentRowValue[];
    completedItems: IOrderStatusItem[];

    // Error
    checkoutError: string | undefined;
    cartError: unknown;

    // Abandon
    isCancelling: boolean;

    // Actions
    startCheckout: (paymentInfo: IPaymentFormData) => void;
    recordCafeCompleted: (cafeId: string, result: ICompleteOrderResult) => void;
    cancelOrder: () => void;
    retryCartLoad: () => void;
}

export const useCheckoutFlow = (): ICheckoutFlowState => {
    const cart = useServerCartItems();
    const activeOrder = useServerCartActiveOrder();
    const hasUnavailableItems = useServerCartHasUnavailableItems();
    const cartQuery = useCartQuery();

    const startCheckoutMutation = useStartCheckoutMutation();
    const abandonMutation = useAbandonRemainingCafesMutation();

    const [checkoutResult, setCheckoutResult] = useState<IStartCheckoutResult>();
    const [checkoutError, setCheckoutError] = useState<string>();
    const [completedResultsByCafeId, setCompletedResultsByCafeId] = useState<Record<string, ICompleteOrderResult>>({});

    // Derived cart data
    const availableItems = useMemo(() => cart.filter(item => item.isAvailable), [cart]);
    const hasAvailableItems = availableItems.length > 0;
    const availableCafeCount = useMemo(
        () => new Set(availableItems.map(item => item.menuItem.cafeId)).size,
        [availableItems],
    );

    // Derived order data
    const currentOrderId = activeOrder?.orderSessionId ?? checkoutResult?.orderSessionId;
    const cafePayments = useMemo(
        () => mergeCafeParts(activeOrder, checkoutResult, completedResultsByCafeId),
        [activeOrder, checkoutResult, completedResultsByCafeId],
    );
    const completedItems = useMemo<IOrderStatusItem[]>(
        () => cafePayments
            .filter(cafe => cafe.status === 'completed')
            .map((cafe) => ({
                cafeId:                 cafe.cafeId,
                buyOnDemandOrderNumber: cafe.buyOnDemandOrderNumber,
                waitTimeMin:            cafe.waitTimeMin,
                waitTimeMax:            cafe.waitTimeMax,
                completedAt:            completedResultsByCafeId[cafe.cafeId]?.completedAt,
            })),
        [cafePayments, completedResultsByCafeId],
    );

    // Phase
    const isCheckoutInitiated = startCheckoutMutation.isPending || checkoutResult != null || activeOrder != null;
    const isShowingPaymentStep = cafePayments.length > 0 && currentOrderId != null;
    const isShowingCompletion = cafePayments.length > 0 && cafePayments.every(cafe => cafe.status === 'completed');

    let phase: CheckoutPhase;
    if (cartQuery.isPending && !isShowingPaymentStep && !isShowingCompletion) {
        phase = 'loading';
    } else if (cartQuery.isError && !isShowingPaymentStep && !isShowingCompletion) {
        phase = 'cart-error';
    } else if (!hasAvailableItems && !hasUnavailableItems && !isShowingPaymentStep && !isShowingCompletion) {
        phase = 'empty';
    } else if (isShowingCompletion) {
        phase = 'completed';
    } else if (isShowingPaymentStep) {
        phase = 'payment';
    } else {
        phase = 'pre-checkout';
    }

    // Actions
    const startCheckout = useCallback((paymentInfo: IPaymentFormData) => {
        if (startCheckoutMutation.isPending) {
            return;
        }
        setCheckoutError(undefined);
        startCheckoutMutation.mutateAsync(paymentInfo)
            .then(result => {
                setCheckoutResult(result);
                setCompletedResultsByCafeId({});
            })
            .catch(error => {
                setCheckoutError(getErrorMessage(error, 'Failed to start checkout'));
            });
    }, [startCheckoutMutation]);

    const recordCafeCompleted = useCallback((cafeId: string, result: ICompleteOrderResult) => {
        setCompletedResultsByCafeId(current => ({ ...current, [cafeId]: result }));
    }, []);

    const cancelOrder = useCallback(() => {
        if (currentOrderId == null || abandonMutation.isPending) {
            return;
        }
        abandonMutation.mutateAsync(currentOrderId)
            .then(() => {
                setCheckoutResult(undefined);
                setCheckoutError(undefined);
                setCompletedResultsByCafeId({});
            })
            .catch(error => {
                setCheckoutError(getErrorMessage(error, 'Failed to cancel order'));
            });
    }, [abandonMutation, currentOrderId]);

    const retryCartLoad = useCallback(() => {
        void cartQuery.refetch();
    }, [cartQuery]);

    return {
        phase,
        hasAvailableItems,
        hasUnavailableItems,
        availableCafeCount,
        checkoutResult,
        activeOrder,
        currentOrderId,
        isCheckoutInitiated,
        isCheckoutPending: startCheckoutMutation.isPending,
        cafePayments,
        completedItems,
        checkoutError,
        cartError: cartQuery.error,
        isCancelling: abandonMutation.isPending,
        startCheckout,
        recordCafeCompleted,
        cancelOrder,
        retryCartLoad,
    };
};
