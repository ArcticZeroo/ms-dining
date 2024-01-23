import React from 'react';
import { HtmlInputType } from '../../../models/html.ts';
import { ValidationState } from '../../../models/validation.ts';
import { classNames } from '../../../util/react.ts';

interface IBasePaymentFieldProps {
    id: string;
    icon: string;
    name: string;
    inputType?: HtmlInputType;
    description?: string;
    onValueChanged(value: string): void;
}

interface IPaymentFieldWithoutValidationProps extends IBasePaymentFieldProps {
    value: string;
    validationState?: undefined;
}

interface IPaymentFieldWithValidationProps extends IBasePaymentFieldProps {
    validationState: ValidationState<unknown>;
    value?: undefined;
}

export const PaymentField: React.FC<IPaymentFieldWithValidationProps | IPaymentFieldWithoutValidationProps> = ({
    id, 
    inputType = 'text', 
    icon, 
    name, 
    description,
    value,
    validationState, 
    onValueChanged }) => {
    const rawValue = value ?? validationState.rawValue;
    const isValid = validationState?.isValid ?? true;
    const shouldShowInvalid = rawValue.length > 0 && !isValid;

    return (
        <div className={classNames('field flex-col flex-grow', shouldShowInvalid && 'invalid')}>
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
                value={rawValue}
                onChange={event => onValueChanged(event.target.value)}
                required
            />
        </div>
    );
}