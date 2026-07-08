import React from 'react';
import type { FulfillmentType } from '@msdining/common/models/order';
import { MaterialIcon } from '../../../icon/material-icon.tsx';
import { classNames } from '../../../../util/react.ts';

interface IFulfillmentOption {
    type: FulfillmentType;
    label: string;
    icon: string;
}

const FULFILLMENT_OPTIONS: IFulfillmentOption[] = [
    { type: 'pickup', label: 'Pickup', icon: 'takeout_dining' },
    { type: 'dineIn', label: 'Dine-in', icon: 'restaurant' },
];

interface IFulfillmentTypeSelectorProps {
    value: FulfillmentType;
    onChange: (value: FulfillmentType) => void;
    disabled?: boolean;
}

export const FulfillmentTypeSelector: React.FC<IFulfillmentTypeSelectorProps> = ({ value, onChange, disabled }) => (
    <div className="card field" role="group" aria-label="Order fulfillment type">
        <div className="flex-col field-info">
            <div className="field-title flex">
                <span className="material-symbols-outlined">
                    restaurant_menu
                </span>
                <span>
                    Pickup or Dine-in
                </span>
            </div>
        </div>
        {FULFILLMENT_OPTIONS.map(option => (
            <button
                key={option.type}
                type="button"
                disabled={disabled}
                aria-pressed={value === option.type}
                className={classNames('default-container fulfillment-type-option flex flex-center', value === option.type && 'active')}
                onClick={() => onChange(option.type)}
            >
                <MaterialIcon name={option.icon}/>
                <span>{option.label}</span>
            </button>
        ))}
    </div>
);
