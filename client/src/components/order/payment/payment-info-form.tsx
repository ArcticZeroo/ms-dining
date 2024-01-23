import { ICardData } from '@msdining/common/dist/models/cart.ts';
import React, { useMemo, useState } from 'react';

import { PaymentField } from './payment-field.tsx';
import { useFieldWithValidator } from '../../../hooks/order.ts';
import { expectValid, validateCvv, validateExpirationMonth, validatePhoneNumber } from '../../../util/validation.ts';
import { classNames } from '../../../util/react.ts';

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
    const [phoneNumber, setPhoneNumber] = useFieldWithValidator(validatePhoneNumber);
    const [alias, setAlias] = useState('');

    const [name, setName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiration, setExpiration] = useFieldWithValidator(validateExpirationMonth);
    const [securityCode, setSecurityCode] = useFieldWithValidator(validateCvv);
    const [postalCode, setPostalCode] = useState('');

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

        const paymentInfo: IPaymentInfo = {
            phoneNumberWithCountryCode: expectValid(phoneNumber),
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