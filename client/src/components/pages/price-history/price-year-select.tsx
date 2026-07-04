import React from 'react';

interface IPriceYearSelectProps {
    label: string;
    value: number | null;
    options: number[];
    onChange: (year: number) => void;
}

export const PriceYearSelect: React.FC<IPriceYearSelectProps> = ({ label, value, options, onChange }) => (
    <label className="flex-inline">
        {label}
        <select value={value ?? ''} onChange={event => onChange(Number(event.target.value))}>
            {
                options.map(year => <option key={year} value={year}>{year}</option>)
            }
        </select>
    </label>
);
