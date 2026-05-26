import { useMemo } from 'react';
import { InternalSettings } from '../constants/settings.ts';
import { useValueNotifierAsState } from './events.ts';
import { validatePhoneNumber } from '../util/validation.ts';

export interface IPaymentIdentity {
    alias: string;
    phoneNumber: string;
}

/**
 * Manages payment identity (alias + phone number) backed by InternalSettings.
 * Returns the current values, setters, validity, and a getter for the
 * validated identity (returns null if invalid).
 */
export const usePaymentIdentity = () => {
    const [alias, setAlias] = useValueNotifierAsState(InternalSettings.alias);
    const [phoneNumber, setPhoneNumber] = useValueNotifierAsState(InternalSettings.phoneNumber);

    const phoneValidation = useMemo(() => validatePhoneNumber(phoneNumber), [phoneNumber]);
    const validatedPhoneNumber = phoneValidation.isValid ? phoneValidation.parsedValue : null;
    const isValid = validatedPhoneNumber != null && alias.trim().length > 0;

    return {
        alias,
        phoneValidation,
        validatedPhoneNumber,
        setAlias,
        setPhoneNumber,
        isValid,
    };
};
