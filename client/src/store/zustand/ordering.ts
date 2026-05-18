import { IOrderCompletionData, IPreparePaymentResponse } from '@msdining/common/models/cart';
import { create } from 'zustand';
import { mutative } from 'zustand-mutative';
import { useShallow } from 'zustand/react/shallow';

export interface IPaymentFormData {
    phoneNumberWithCountryCode: string;
    alias: string;
}

export interface ICafePaymentSlice {
    orderId: string;
    iframeUrl: string | undefined;
    completionResult: IOrderCompletionData | undefined;
    error: string | undefined;
}

interface IOrderingStore {
    formData: IPaymentFormData | undefined;
    paymentsByCafeId: Map<string, ICafePaymentSlice>;

    /**
     * Replaces the entire payments map with fresh slices from a preparePayment
     * call for each cafe. Implicitly clears any prior completed checkout.
     */
    startCheckout(
        formData: IPaymentFormData,
        prepareByCafeId: Record<string, IPreparePaymentResponse>,
    ): void;

    setIframeUrl(cafeId: string, iframeUrl: string | undefined): void;
    setError(cafeId: string, error: string | undefined): void;
    recordCompletion(cafeId: string, result: IOrderCompletionData): void;
    reset(): void;
}

export const useOrderingStore = create<IOrderingStore>()(mutative((set) => ({
    formData:         undefined,
    paymentsByCafeId: new Map(),

    startCheckout: (formData, prepareByCafeId) => set((state) => {
        state.formData = formData;
        state.paymentsByCafeId = new Map();
        for (const [cafeId, prepare] of Object.entries(prepareByCafeId)) {
            state.paymentsByCafeId.set(cafeId, {
                orderId:          prepare.orderId,
                iframeUrl:        prepare.iframeUrl,
                completionResult: undefined,
                error:            undefined,
            });
        }
    }),

    setIframeUrl: (cafeId, iframeUrl) => set((state) => {
        const slice = state.paymentsByCafeId.get(cafeId);
        if (!slice) {
            return;
        }
        slice.iframeUrl = iframeUrl;
        slice.error = undefined;
    }),

    setError: (cafeId, error) => set((state) => {
        const slice = state.paymentsByCafeId.get(cafeId);
        if (!slice) {
            return;
        }
        slice.error = error;
    }),

    recordCompletion: (cafeId, result) => set((state) => {
        const slice = state.paymentsByCafeId.get(cafeId);
        if (!slice) {
            return;
        }
        slice.completionResult = result;
        slice.error = undefined;
    }),

    reset: () => set((state) => {
        state.formData = undefined;
        state.paymentsByCafeId = new Map();
    }),
})));

const allCafesCompleteSelector = (state: IOrderingStore): boolean => {
    if (state.paymentsByCafeId.size === 0) {
        return false;
    }
    for (const slice of state.paymentsByCafeId.values()) {
        if (slice.completionResult == null) {
            return false;
        }
    }
    return true;
};

export const useAllCafesComplete = (): boolean => useOrderingStore(allCafesCompleteSelector);

export const useCompletionResults = () =>
    useOrderingStore(useShallow((state) => {
        const results: Record<string, IOrderCompletionData> = {};
        for (const [cafeId, slice] of state.paymentsByCafeId.entries()) {
            if (slice.completionResult != null) {
                results[cafeId] = slice.completionResult;
            }
        }
        return results;
    }));
