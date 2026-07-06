import React from 'react';

interface IPaymentSkeletonExpirationFieldProps {
    currentDate: Date;
}

export const PaymentSkeletonExpirationField: React.FC<IPaymentSkeletonExpirationFieldProps> = ({ currentDate }) => (
    <div className="field">
        <label>
            Expiration Date
        </label>
        <div className="flex">
            <select value={currentDate.getMonth() + 1} disabled/>
            <select value={currentDate.getFullYear()} disabled/>
        </div>
    </div>
);
