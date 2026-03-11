import { ICardData } from '@msdining/common/models/cart';
import React, { useMemo, useState } from 'react';
import { InternalSettings } from '../../../constants/settings.ts';
import { useFieldWithValidator } from '../../../hooks/order.ts';
import { classNames } from '../../../util/react.ts';

import './payment-info-form.css';
import {
    expectValid,
    validatePhoneNumber,
} from '../../../util/validation.ts';

import { PaymentField } from './payment-field.tsx';

export interface IPaymentInfo {
    phoneNumberWithCountryCode: string;
    alias: string;
    cardData: ICardData;
}

export interface IPaymentFormData {
    phoneNumberWithCountryCode: string;
    alias: string;
}

interface IPaymentInfoFormProps {
    onSubmit(data: IPaymentFormData): void;
}

export const PaymentInfoForm: React.FC<IPaymentInfoFormProps> = ({ onSubmit }) => {
    const [phoneNumber, setPhoneNumber] = useFieldWithValidator(validatePhoneNumber, InternalSettings.phoneNumber.value /*initialValue*/);
    const [alias, setAlias] = useState(InternalSettings.alias.value);

    const isFormValid = useMemo(
        () => {
            const fields = [
                phoneNumber,
                alias,
            ];

            return fields.every(field => {
                if (typeof field === 'string') {
                    return field.length > 0;
                }

                return field.isValid;
            });
        },
        [phoneNumber, alias]
    );

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        if (!isFormValid) {
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
                />
                <PaymentField
                    id="alias"
                    icon="alternate_email"
                    name="Alias"
                    description="Your alias will appear on your receipt."
                    value={alias}
                    onValueChanged={setAlias}
                />
            </div>
            <button
                type="submit"
                id="payment-submit"
                className={classNames('default-container', !isFormValid && 'invalid')}
                title={isFormValid ? 'Click to pay' : 'Please fill out all fields and check for validation errors.'}
                disabled={!isFormValid}
            >
                Pay with Card
            </button>
        </form>
    );
}