import React from 'react';
import type { FulfillmentType } from '@msdining/common/models/order';
import type { ValidationState } from '../../../../models/validation.ts';
import { PaymentField } from './payment-field.tsx';
import { FulfillmentTypeSelector } from './fulfillment-type-selector.tsx';

import './payment-info-form.css';

interface IOrderMetadataFormProps {
    alias: string;
    phoneValidation: ValidationState<string>;
    onAliasChanged: (alias: string) => void;
    onPhoneNumberChanged: (phoneNumber: string) => void;
    fulfillmentType: FulfillmentType;
    onFulfillmentTypeChanged: (fulfillmentType: FulfillmentType) => void;
    showFulfillmentTypeSelector: boolean;
    readOnly?: boolean;
}

export const OrderMetadataForm: React.FC<IOrderMetadataFormProps> = ({
    alias,
    phoneValidation,
    onAliasChanged,
    onPhoneNumberChanged,
    fulfillmentType,
    onFulfillmentTypeChanged,
    showFulfillmentTypeSelector,
    readOnly = false,
}) => (
    <div className="flex-col">
        <div id="payment-info" className="flex flex-wrap flex-justify-center">
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
            {
                showFulfillmentTypeSelector && (
                    <FulfillmentTypeSelector
                        value={fulfillmentType}
                        onChange={onFulfillmentTypeChanged}
                        disabled={readOnly}
                    />
                )
            }
        </div>
    </div>
);
