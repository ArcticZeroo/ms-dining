import React from 'react';

interface IPaymentSkeletonInputFieldProps {
    label: string;
}

export const PaymentSkeletonInputField: React.FC<IPaymentSkeletonInputFieldProps> = ({ label }) => (
    <div className="field">
        <label>
            {label}
        </label>
        <input disabled/>
    </div>
);
