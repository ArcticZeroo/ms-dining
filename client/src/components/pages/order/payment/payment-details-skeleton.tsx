import React from 'react';
import { PaymentSkeletonExpirationField } from './payment-skeleton-expiration-field.tsx';
import { PaymentSkeletonInputField } from './payment-skeleton-input-field.tsx';

import './payment-details-skeleton.css';

const CARD_INFORMATION_FIELD_LABELS = ['Card Holder Name', 'Card Number'];
const CARD_VERIFICATION_FIELD_LABELS = ['CVV', 'Zip/Postal Code'];

/**
 * A placeholder that mimics the rguest card-entry form. Shown while the payment
 * iframe loads — the iframe is cross-origin and sends no resize/ready message,
 * so we can't reflect its real layout; this just hints at the upcoming form.
 */
export const PaymentDetailsSkeleton: React.FC = () => {
    const currentDate = new Date();

    return (
        <div className="payment-skeleton flex-col loading-skeleton" aria-hidden={true}>
            {CARD_INFORMATION_FIELD_LABELS.map(label => (
                <PaymentSkeletonInputField key={label} label={label}/>
            ))}
            <PaymentSkeletonExpirationField currentDate={currentDate}/>
            {CARD_VERIFICATION_FIELD_LABELS.map(label => (
                <PaymentSkeletonInputField key={label} label={label}/>
            ))}
            <button disabled className="default-button default-container">
                PROCESS
            </button>
            <button disabled className="default-container">
                Clear
            </button>
        </div>
    );
};
