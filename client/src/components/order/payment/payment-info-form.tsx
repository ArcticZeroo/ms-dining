import { ICardData } from '@msdining/common/dist/models/cart.ts';
import React, { useState } from 'react';

import './payment-info-form.css';
import { PaymentField } from './payment-field.tsx';

export interface IPaymentInfo {
    phoneNumberWithCountryCode: string;
    alias: string;
    cardData: ICardData;
}

interface IPaymentInfoFormProps {
    onSubmit(paymentInfo: IPaymentInfo): void;
}

export const PaymentInfoForm: React.FC<IPaymentInfoFormProps> = ({ onSubmit }) => {
    const [phoneNumberWithCountryCode, setPhoneNumberWithCountryCode] = useState('');
    const [alias, setAlias] = useState('');

    const [name, setName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiration, setExpiration] = useState('');
    const [securityCode, setSecurityCode] = useState('');
    const [postalCode, setPostalCode] = useState('');

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        const [expirationYear, expirationMonth] = expiration.split('-');

        const paymentInfo: IPaymentInfo = {
            phoneNumberWithCountryCode,
            alias,
            cardData: {
                name,
                cardNumber,
                expirationMonth,
                expirationYear,
                securityCode,
                postalCode,
                userAgent:       JSON.stringify({ userAgent: navigator.userAgent })
            }
        };

        onSubmit(paymentInfo);
    };

    return (
        <form onSubmit={onFormSubmitted} id="payment-info" className="card">
            <PaymentField
                id="phoneNumberWithCountryCode"
                icon="phone"
                name="Phone Number"
                description="Order updates will be sent via text to this number."
                inputType="tel"
                value={phoneNumberWithCountryCode}
                onValueChanged={setPhoneNumberWithCountryCode}
            />
            <PaymentField
                id="alias"
                icon="person"
                name="Alias"
                value={alias}
                onValueChanged={setAlias}
            />
            <div className="title">
                Card Info
            </div>
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
                value={expiration}
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
            <button type="submit" className="default-container">
                Submit
            </button>
        </form>
    );
}