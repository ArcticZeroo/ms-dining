import React from 'react';

import './payment-details-skeleton.css';

/**
 * A placeholder that mimics the rguest card-entry form. Shown while the payment
 * iframe loads — the iframe is cross-origin and sends no resize/ready message,
 * so we can't reflect its real layout; this just hints at the upcoming form.
 */
export const PaymentDetailsSkeleton: React.FC = () => {
    const currentDate = new Date();

    return (
        <div className="payment-skeleton flex-col loading-skeleton" aria-hidden={true}>
            <div className="field">
                <label>
                    Card Holder Name
                </label>
                <input disabled/>
            </div>
            <div className="field">
                <label>
                    Card Number
                </label>
                <input disabled/>
            </div>
            <div className="field">
                <label>
                    Expiration Date
                </label>
                <div className="flex">
                    <select value={currentDate.getMonth() + 1} disabled/>
                    <select value={currentDate.getFullYear()} disabled/>
                </div>
            </div>
            <div className="field">
                <label>
                    CVV
                </label>
                <input disabled/>
            </div>
            <div className="field">
                <label>
                    Zip/Postal Code
                </label>
                <input disabled/>
            </div>
            <button disabled className="default-button default-container">
                PROCESS
            </button>
            <button disabled className="default-container">
                Clear
            </button>
        </div>
    );
};
