import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InternalSettings } from '../../../constants/settings.ts';
import { useFieldWithValidator } from '../../../hooks/order.ts';
import { IPaymentFormData } from '../../../store/zustand/ordering.ts';
import { classNames } from '../../../util/react.ts';
import {
    expectValid,
    validatePhoneNumber,
} from '../../../util/validation.ts';
import { PaymentField } from './payment-field.tsx';

import './payment-info-form.css';

export type { IPaymentFormData };

export interface IPaymentInfoFormValue {
    alias: string;
    phoneNumber: string;
}

export interface IPaymentInfoFormState extends IPaymentInfoFormValue {
    isValid: boolean;
    phoneNumberWithCountryCode?: string;
}

interface IPaymentInfoFormProps {
    isPrepareStarted: boolean;
    isCartReady: boolean;
    submitLabel?: string;
    onSubmit?(data: IPaymentFormData): void;
    value?: IPaymentInfoFormValue;
    onValueChanged?(value: IPaymentInfoFormValue): void;
    onValidationChanged?(state: IPaymentInfoFormState): void;
    hideSubmit?: boolean;
}

export const PaymentInfoForm: React.FC<IPaymentInfoFormProps> = ({
    isPrepareStarted,
    isCartReady,
    submitLabel = 'Pay with Card',
    onSubmit,
    value,
    onValueChanged,
    onValidationChanged,
    hideSubmit = false,
}) => {
    const [internalPhoneNumber, setInternalPhoneNumber] = useFieldWithValidator(validatePhoneNumber, InternalSettings.phoneNumber.value /*initialValue*/);
    const [internalAlias, setInternalAlias] = useState(InternalSettings.alias.value);

    const alias = value?.alias ?? internalAlias;
    const phoneNumber = useMemo(
        () => value == null ? internalPhoneNumber : validatePhoneNumber(value.phoneNumber),
        [internalPhoneNumber, value],
    );
    const phoneNumberRawValue = value?.phoneNumber ?? internalPhoneNumber.rawValue;

    const isFormValid = useMemo(
        () => phoneNumber.isValid && alias.trim().length > 0,
        [phoneNumber, alias],
    );

    const formState = useMemo<IPaymentInfoFormState>(() => ({
        alias,
        phoneNumber:                phoneNumberRawValue,
        isValid:                    isFormValid,
        phoneNumberWithCountryCode: phoneNumber.isValid ? phoneNumber.parsedValue : undefined,
    }), [alias, isFormValid, phoneNumber, phoneNumberRawValue]);

    useEffect(() => {
        onValidationChanged?.(formState);
    }, [formState, onValidationChanged]);

    const setPhoneNumber = useCallback((nextPhoneNumber: string) => {
        if (value != null) {
            onValueChanged?.({
                alias,
                phoneNumber: nextPhoneNumber,
            });
            return;
        }

        setInternalPhoneNumber(nextPhoneNumber);
    }, [alias, onValueChanged, setInternalPhoneNumber, value]);

    const setAlias = useCallback((nextAlias: string) => {
        if (value != null) {
            onValueChanged?.({
                alias: nextAlias,
                phoneNumber: phoneNumberRawValue,
            });
            return;
        }

        setInternalAlias(nextAlias);
    }, [onValueChanged, phoneNumberRawValue, value]);

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        if (!isFormValid || onSubmit == null) {
            return;
        }

        const phoneNumberWithCountryCode = expectValid(phoneNumber);

        InternalSettings.phoneNumber.value = phoneNumberWithCountryCode;
        InternalSettings.alias.value = alias;

        onSubmit({ phoneNumberWithCountryCode, alias });
    };

    return (
        <form onSubmit={onFormSubmitted} id="payment-info" className="card">
            <div className="payment-section">
                <PaymentField
                    id="phoneNumberWithCountryCode"
                    icon="phone"
                    name="Phone Number"
                    description="Order updates will be sent via text to this number."
                    inputType="tel"
                    validationState={phoneNumber}
                    onValueChanged={setPhoneNumber}
                    isEnabled={!isPrepareStarted}
                />
                <PaymentField
                    id="alias"
                    icon="alternate_email"
                    name="Alias"
                    description="Your alias will appear on your receipt."
                    value={alias}
                    onValueChanged={setAlias}
                    isEnabled={!isPrepareStarted}
                />
            </div>
            {!hideSubmit && onSubmit != null && !isPrepareStarted && (
                <button
                    type="submit"
                    id="payment-submit"
                    className={classNames('default-container', !isFormValid && 'invalid')}
                    title={isFormValid ? 'Click to pay' : 'Please fill out all fields and check for validation errors.'}
                    disabled={!isFormValid || !isCartReady}
                >
                    {submitLabel}
                </button>
            )}
        </form>
    );
};
