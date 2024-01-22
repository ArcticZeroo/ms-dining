import { ICardData } from '@msdining/common/dist/models/cart';
import React, { useState } from 'react';

import './payment-info-form.css';

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
    const [expirationMonth, setExpirationMonth] = useState('');
    const [expirationYear, setExpirationYear] = useState('');
    const [securityCode, setSecurityCode] = useState('');
    const [postalCode, setPostalCode] = useState('');

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

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
                userAgent: JSON.stringify({ userAgent: navigator.userAgent })
            }
        };

        onSubmit(paymentInfo);
    };

    return (
        <form onSubmit={onFormSubmitted} id="payment-info" className="card">
            <div className="field">
                <label htmlFor="phoneNumberWithCountryCode">Phone Number</label>
                <input
                    id="phoneNumberWithCountryCode"
                    type="tel"
                    value={phoneNumberWithCountryCode}
                    onChange={event => setPhoneNumberWithCountryCode(event.target.value)}
                    required
                />
            </div>
            <div className="field">
                <label htmlFor="alias">Alias</label>
                <input
                    id="alias"
                    type="text"
                    value={alias}
                    onChange={event => setAlias(event.target.value)}
                    required
                />
            </div>
            <div className="field">
                <label htmlFor="name">Name on Card</label>
                <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    required
                />
            </div>
            <div className="field">
                <label htmlFor="cardNumber">Card Number</label>
                <input
                    id="cardNumber"
                    type="text"
                    value={cardNumber}
                    onChange={event => setCardNumber(event.target.value)}
                    required
                />
            </div>
            <div className="field">
                <label htmlFor="expirationMonth">Expiration Month</label>
                <input
                    id="expirationMonth"
                    type="text"
                    value={expirationMonth}
                    onChange={event => setExpirationMonth(event.target.value)}
                    required
                />
            </div>
            <div className="field">
                <label htmlFor="expirationYear">Expiration Year</label>
                <input
                    id="expirationYear"
                    type="text"
                    value={expirationYear}
                    onChange={event => setExpirationYear(event.target.value)}
                    required
                />
            </div>
            <div className="field">
                <label htmlFor="securityCode">Security Code</label>
                <input
                    id="securityCode"
                    type="text"
                    value={securityCode}
                    onChange={event => setSecurityCode(event.target.value)}
                    required
                />
            </div>
            <div className="field">
                <label htmlFor="postalCode">Postal Code</label>
                <input
                    id="postalCode"
                    type="text"
                    value={postalCode}
                    onChange={event => setPostalCode(event.target.value)}
                    required
                />
            </div>
            <button type="submit" className="default-container">
                Submit
            </button>
        </form>
    );
}