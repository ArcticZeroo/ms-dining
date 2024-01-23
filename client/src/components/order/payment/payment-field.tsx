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
    onValueChanged
}) => {
    if (validationState == null) {
        validationState = {
            isValid:     true,
            rawValue:    value,
            parsedValue: value
        };
    }

    const rawValue = validationState.rawValue;
    const shouldShowInvalid = rawValue.length > 0 && !validationState.isValid;

    return (
        <label
            htmlFor={id}
            className={classNames('field flex-col flex-grow', shouldShowInvalid && 'invalid')}
            title={validationState.isValid ? undefined : validationState.errorMessage}
        >
            <div className="flex-col field-info">
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
            </div>
            <input
                id={id}
                type={inputType}
                value={rawValue}
                onChange={event => onValueChanged(event.target.value)}
                required
            />
        </label>
    );
}