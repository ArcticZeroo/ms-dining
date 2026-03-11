import { IOrderCompletionData, IPrepareOrderResponse } from '@msdining/common/models/cart';
import { useCallback, useContext, useState } from 'react';
import { CartContext } from '../context/cart.ts';
import { OrderingClient } from '../api/order.ts';
import { shallowCloneCart } from '../util/cart.ts';
import { IRguestPaymentResult } from '../components/order/payment/payment-iframe.tsx';
import { ValidationState, Validator } from '../models/validation.ts';

export const useFieldWithValidator = <T>(validator: Validator<T>, initialValue: string = '') => {
    const [validationState, setValidationState] = useState<ValidationState<T>>(() => validator(initialValue));

    const setValue = useCallback(
        (value: string) => {
            setValidationState(validator(value));
        },
        [validator]
    );

    return [validationState, setValue] as const;
};

export interface ICafePaymentState {
    isPreparing: boolean;
    isCompleting: boolean;
    iframeUrl?: string;
    orderId?: string;
    completionResult?: IOrderCompletionData;
    error?: string;
}

interface ICafePaymentFormData {
    phoneNumberWithCountryCode: string;
    alias: string;
}

export const useCafePayment = (cafeId: string, initialPrepareData: IPrepareOrderResponse[string], formData: ICafePaymentFormData) => {
    const cartNotifier = useContext(CartContext);

    const [state, setState] = useState<ICafePaymentState>({
        isPreparing:  false,
        isCompleting: false,
        iframeUrl:    initialPrepareData.iframeUrl,
        orderId:      initialPrepareData.orderId,
    });

    const prepare = useCallback(async () => {
        const cafeItems = cartNotifier.value.get(cafeId);
        if (!cafeItems) {
            return;
        }

        setState(prev => ({ ...prev, isPreparing: true, error: undefined }));

        try {
            const singleCafeCart = new Map([[cafeId, cafeItems]]);
            const response = await OrderingClient.prepareOrder(singleCafeCart, formData);
            const cafeData = response[cafeId];
            if (!cafeData) {
                throw new Error('No prepare data returned for cafe');
            }
            setState(prev => ({
                ...prev,
                isPreparing: false,
                iframeUrl:   cafeData.iframeUrl,
                orderId:     cafeData.orderId,
            }));
        } catch (err) {
            setState(prev => ({
                ...prev,
                isPreparing: false,
                error:       err instanceof Error ? err.message : 'Failed to prepare order',
            }));
        }
    }, [cafeId, cartNotifier, formData]);

    const complete = useCallback(async (result: IRguestPaymentResult): Promise<IOrderCompletionData> => {
        if (!state.orderId) {
            throw new Error('No order ID — cannot complete');
        }

        setState(prev => ({ ...prev, isCompleting: true, error: undefined }));

        try {
            const completeResult = await OrderingClient.completeOrder({
                orderId:      state.orderId,
                paymentToken: result.token,
                cardInfo:     result.cardInfo,
                alias:        formData.alias,
            });
            const newCart = shallowCloneCart(cartNotifier.value);
            newCart.delete(cafeId);
            cartNotifier.value = newCart;
            setState(prev => ({ ...prev, isCompleting: false, completionResult: completeResult }));
            return completeResult;
        } catch (err) {
            setState(prev => ({
                ...prev,
                isCompleting: false,
                error:        err instanceof Error ? err.message : 'Failed to complete order',
            }));
            throw err;
        }
    }, [cafeId, state.orderId, formData.alias, cartNotifier]);

    const invalidatePrepare = useCallback(() => {
        setState(prev => ({ ...prev, iframeUrl: undefined, orderId: undefined }));
    }, []);

    const setError = useCallback((error: string) => {
        setState(prev => ({ ...prev, error }));
    }, []);

    return { state, prepare, complete, invalidatePrepare, setError };
};