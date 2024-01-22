import React from 'react';
import { HtmlInputType } from '../../../models/html.ts';

interface IPaymentFieldProps {
    id: string;
    icon: string;
    name: string;
    inputType?: HtmlInputType;
    description?: string;
    value: string;
    onValueChanged(value: string): void;
}

export const PaymentField: React.FC<IPaymentFieldProps> = ({ id, inputType = 'text', icon, name, description, value, onValueChanged }) => {
    return (
        <div className="field">
            <label htmlFor={id}>
                <div className="field-title flex">
                    <span className="material-symbols-outlined">
                        {icon}
                    </span>
                    <span>
                        {name}
                    </span>
                </div>
                {
                    description && (
                        <div className="field-description subtitle">
                            {description}
                        </div>
                    )
                }
            </label>
            <input
                id={id}
                type={inputType}
                value={value}
                onChange={event => onValueChanged(event.target.value)}
                required
            />
        </div>
    );
}