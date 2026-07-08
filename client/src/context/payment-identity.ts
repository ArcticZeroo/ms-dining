import { createContext, useContext } from 'react';
import type { FulfillmentType } from '@msdining/common/models/order';

export interface IPaymentIdentityContext {
    alias: string;
    phoneNumber: string;
    isValid: boolean;
    fulfillmentType: FulfillmentType;
}

export const PaymentIdentityContext = createContext<IPaymentIdentityContext | null>(null);

export const usePaymentIdentityContext = (): IPaymentIdentityContext => {
    const ctx = useContext(PaymentIdentityContext);
    if (ctx == null) {
        throw new Error('usePaymentIdentityContext must be used within a PaymentIdentityContext.Provider');
    }
    return ctx;
};
