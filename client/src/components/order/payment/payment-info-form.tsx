import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InternalSettings } from '../../../constants/settings.ts';
import { useFieldWithValidator } from '../../../hooks/order.ts';
import { validatePhoneNumber } from '../../../util/validation.ts';
import { PaymentField } from './payment-field.tsx';

import './payment-info-form.css';

export interface IPaymentFormData {
    alias: string;
    phoneNumberWithCountryCode: string | null;
    isValid: boolean;
}

interface IPaymentInfoFormProps {
    onChange(data: IPaymentFormData): void;
    readOnly?: boolean;
}

export const PaymentInfoForm: React.FC<IPaymentInfoFormProps> = ({
    onChange,
    readOnly = false,
}) => {
    const [phoneNumber, setPhoneNumber] = useFieldWithValidator(validatePhoneNumber, InternalSettings.phoneNumber.value /* initialValue */);
    const [alias, setAlias] = useState(InternalSettings.alias.value);

    const formData = useMemo<IPaymentFormData>(() => ({
        alias,
        phoneNumberWithCountryCode: phoneNumber.isValid ? phoneNumber.parsedValue : null,
        isValid:                    phoneNumber.isValid && alias.trim().length > 0,
    }), [alias, phoneNumber]);

    useEffect(() => {
        onChange(formData);
    }, [formData, onChange]);

    const onPhoneNumberChanged = useCallback((nextPhoneNumber: string) => {
        InternalSettings.phoneNumber.value = nextPhoneNumber;
        setPhoneNumber(nextPhoneNumber);
    }, [setPhoneNumber]);

    const onAliasChanged = useCallback((nextAlias: string) => {
        InternalSettings.alias.value = nextAlias;
        setAlias(nextAlias);
    }, []);

    return (
        <form id="payment-info" className="card">
            <div className="payment-section">
                <PaymentField
                    id="phoneNumberWithCountryCode"
                    icon="phone"
                    name="Phone Number"
                    description="Order updates will be sent via text to this number."
                    inputType="tel"
                    validationState={phoneNumber}
                    onValueChanged={onPhoneNumberChanged}
                    isEnabled={!readOnly}
                />
                <PaymentField
                    id="alias"
                    icon="alternate_email"
                    name="Alias"
                    description="Your alias will appear on your receipt."
                    value={alias}
                    onValueChanged={onAliasChanged}
                    isEnabled={!readOnly}
                />
            </div>
        </form>
    );
};
