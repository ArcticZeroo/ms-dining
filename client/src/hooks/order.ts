import { IOrderCompletionData, IPreparePaymentResponse } from '@msdining/common/models/cart';
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
    orderId: string;
    completionResult?: IOrderCompletionData;
    error?: string;
}

interface ICafePaymentFormData {
    phoneNumberWithCountryCode: string;
    alias: string;
}

export const useCafePayment = (cafeId: string, initialPrepareData: IPreparePaymentResponse, formData: ICafePaymentFormData) => {
    const cartNotifier = useContext(CartContext);

    const [state, setState] = useState<ICafePaymentState>({
        isPreparing:  false,
        isCompleting: false,
        iframeUrl:    initialPrepareData.iframeUrl,
        orderId:      initialPrepareData.orderId,
    });

    // Re-get card processor token for the existing cart session (e.g., after iframe close)
    const prepare = useCallback(async () => {
        setState(prev => ({ ...prev, isPreparing: true, error: undefined }));

        try {
            const response = await OrderingClient.preparePayment(state.orderId);
            setState(prev => ({
                ...prev,
                isPreparing: false,
                iframeUrl:   response.iframeUrl,
            }));
        } catch (err) {
            setState(prev => ({
                ...prev,
                isPreparing: false,
                error:       err instanceof Error ? err.message : 'Failed to prepare payment',
            }));
        }
    }, [state.orderId]);

    const complete = useCallback(async (result: IRguestPaymentResult): Promise<IOrderCompletionData> => {
        setState(prev => ({ ...prev, isCompleting: true, error: undefined }));

        try {
            const completeResult = await OrderingClient.completeOrder({
                orderId:                    state.orderId,
                paymentToken:               result.token,
                cardInfo:                   result.cardInfo,
                alias:                      formData.alias,
                phoneNumberWithCountryCode: formData.phoneNumberWithCountryCode,
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
    }, [cafeId, state.orderId, formData.alias, formData.phoneNumberWithCountryCode, cartNotifier]);

    const invalidatePrepare = useCallback(() => {
        setState(prev => ({ ...prev, iframeUrl: undefined }));
    }, []);

    const setError = useCallback((error: string) => {
        setState(prev => ({ ...prev, error }));
    }, []);

    return { state, prepare, complete, invalidatePrepare, setError };
};