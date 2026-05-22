import React, { useMemo } from 'react';
import { validatePhoneNumber } from '../../../util/validation.ts';
import { PaymentField } from './payment-field.tsx';

import './payment-info-form.css';

interface IPaymentInfoFormProps {
    alias: string;
    phoneNumber: string;
    onAliasChanged: (alias: string) => void;
    onPhoneNumberChanged: (phoneNumber: string) => void;
    readOnly?: boolean;
}

export const PaymentInfoForm: React.FC<IPaymentInfoFormProps> = ({
    alias,
    phoneNumber,
    onAliasChanged,
    onPhoneNumberChanged,
    readOnly = false,
}) => {
    const phoneValidation = useMemo(() => validatePhoneNumber(phoneNumber), [phoneNumber]);

    return (
        <div id="payment-info" className="card">
            <div className="payment-section">
                <PaymentField
                    id="phoneNumberWithCountryCode"
                    icon="phone"
                    name="Phone Number"
                    description="Order updates will be sent via text to this number."
                    inputType="tel"
                    validationState={phoneValidation}
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
        </div>
    );
};
