import { ICardData } from '@msdining/common/dist/models/cart';
import React, { useMemo, useState } from 'react';
import { useFieldWithValidator } from '../../../hooks/order.ts';
import { classNames } from '../../../util/react.ts';

import './payment-info-form.css';
import { expectValid, validateCvv, validateExpirationMonth, validatePhoneNumber } from '../../../util/validation.ts';

import { PaymentField } from './payment-field.tsx';
import { InternalSettings } from '../../../constants/settings.ts';

export interface IPaymentInfo {
    phoneNumberWithCountryCode: string;
    alias: string;
    cardData: ICardData;
}

interface IPaymentInfoFormProps {
    onSubmit(paymentInfo: IPaymentInfo): void;
}

export const PaymentInfoForm: React.FC<IPaymentInfoFormProps> = ({ onSubmit }) => {
    const [phoneNumber, setPhoneNumber] = useFieldWithValidator(validatePhoneNumber, InternalSettings.phoneNumber.value /*initialValue*/);
    const [alias, setAlias] = useState(InternalSettings.alias.value);

    const [name, setName] = useState(InternalSettings.nameOnCard.value);
    const [cardNumber, setCardNumber] = useState('');
    const [expiration, setExpiration] = useFieldWithValidator(validateExpirationMonth);
    const [securityCode, setSecurityCode] = useFieldWithValidator(validateCvv);
    const [postalCode, setPostalCode] = useState(InternalSettings.postalCode.value);

    const isFormValid = useMemo(
        () => {
            const fields = [
                phoneNumber,
                alias,
                name,
                cardNumber,
                expiration,
                securityCode,
                postalCode
            ];

            return fields.every(field => {
                if (typeof field === 'string') {
                    return field.length > 0;
                }

                return field.isValid;
            });
        },
        [phoneNumber, alias, name, cardNumber, expiration, securityCode, postalCode]
    );

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        if (!isFormValid) {
            return;
        }

        const { month, year } = expectValid(expiration);
        const phoneNumberWithCountryCode = expectValid(phoneNumber);

        const paymentInfo: IPaymentInfo = {
            phoneNumberWithCountryCode,
            alias,
            cardData:                   {
                name,
                cardNumber,
                postalCode,
                securityCode:    expectValid(securityCode),
                expirationMonth: month.toString(),
                expirationYear:  year.toString(),
                userAgent:       JSON.stringify({ userAgent: navigator.userAgent })
            }
        };

        InternalSettings.phoneNumber.value = phoneNumberWithCountryCode;
        InternalSettings.alias.value = alias;
        InternalSettings.nameOnCard.value = name;
        InternalSettings.postalCode.value = postalCode;

        onSubmit(paymentInfo);
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
            <div className="payment-section">
                <PaymentField
                    id="name"
                    icon="person"
                    name="Name on Card"
                    value={name}
                    onValueChanged={setName}
                />
                <PaymentField
                    id="cardNumber"
                    icon="credit_card"
                    name="Card Number"
                    value={cardNumber}
                    onValueChanged={setCardNumber}
                />
                <PaymentField
                    id="expiration"
                    icon="event"
                    name="Expiration"
                    inputType="month"
                    validationState={expiration}
                    onValueChanged={setExpiration}
                />
                <PaymentField
                    id="securityCode"
                    icon="lock"
                    name="Security Code"
                    validationState={securityCode}
                    onValueChanged={setSecurityCode}
                />
                <PaymentField
                    id="postalCode"
                    icon="location_on"
                    name="Postal Code"
                    value={postalCode}
                    onValueChanged={setPostalCode}
                />
            </div>
            <button
                type="submit"
                id="payment-submit"
                className={classNames('default-container', !isFormValid && 'invalid')}
                title={isFormValid ? 'Click to submit your order' : 'Please fill out all fields and check for validation errors.'}
                disabled={!isFormValid}
            >
                Submit
            </button>
        </form>
    );
}