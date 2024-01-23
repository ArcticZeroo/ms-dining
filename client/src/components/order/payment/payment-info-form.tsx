import { ICardData } from '@msdining/common/dist/models/cart.ts';
import React, { useState } from 'react';

import './payment-info-form.css';
import { PaymentField } from './payment-field.tsx';
import { useFieldWithValidator } from '../../../hooks/order.ts';
import { expectValid, validateExpirationMonth, validatePhoneNumber } from '../../../util/validation.ts';

export interface IPaymentInfo {
    phoneNumberWithCountryCode: string;
    alias: string;
    cardData: ICardData;
}

interface IPaymentInfoFormProps {
    onSubmit(paymentInfo: IPaymentInfo): void;
}

export const PaymentInfoForm: React.FC<IPaymentInfoFormProps> = ({ onSubmit }) => {
    const [phoneNumber, setPhoneNumber] = useFieldWithValidator(validatePhoneNumber);
    const [alias, setAlias] = useState('');

    const [name, setName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiration, setExpiration] = useFieldWithValidator(validateExpirationMonth);
    const [securityCode, setSecurityCode] = useState('');
    const [postalCode, setPostalCode] = useState('');

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        const fields = [
            phoneNumber,
            alias,
            name,
            cardNumber,
            expiration,
            securityCode,
            postalCode
        ];

        const allFieldsValid = fields.every(field => typeof field === 'string' || field.isValid);

        if (!allFieldsValid) {
            return;
        }

        const { month, year } = expectValid(expiration);

        const paymentInfo: IPaymentInfo = {
            phoneNumberWithCountryCode: expectValid(phoneNumber),
            alias,
            cardData:                   {
                name,
                cardNumber,
                securityCode,
                postalCode,
                expirationMonth: month.toString(),
                expirationYear:  year.toString(),
                userAgent:       JSON.stringify({ userAgent: navigator.userAgent })
            }
        };

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
                    value={securityCode}
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
            <button type="submit" className="default-container">
                Submit
            </button>
        </form>
    );
}