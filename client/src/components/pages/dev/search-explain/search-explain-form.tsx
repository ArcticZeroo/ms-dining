import React, { useState } from 'react';
import { ItemNameInput } from './item-name-input.tsx';
import { InfoTip } from './info-tip.tsx';

export interface IExplainRequest {
    query: string;
    name: string;
    date?: string;
}

interface ISearchExplainFormProps {
    isPending: boolean;
    onExplain: (request: IExplainRequest) => void;
}

export const SearchExplainForm: React.FC<ISearchExplainFormProps> = ({ isPending, onExplain }) => {
    const [query, setQuery] = useState('');
    const [itemName, setItemName] = useState('');
    const [date, setDate] = useState('');

    const canSubmit = query.trim().length > 0 && itemName.trim().length > 0;

    const onSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) {
            return;
        }
        onExplain({ query: query.trim(), name: itemName.trim(), date: date.trim() || undefined });
    };

    return (
        <form className="search-explain-form flex-col" onSubmit={onSubmit}>
            <label className="explain-field flex-col">
                <span className="explain-field-label">Search query</span>
                <input
                    type="text"
                    placeholder="e.g. birria"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                />
            </label>

            <div className="explain-field flex-col">
                <span className="explain-field-label">Item name</span>
                <ItemNameInput value={itemName} onChange={setItemName}/>
            </div>

            <div className="explain-field flex-col">
                <span className="explain-field-label">
                    Date <InfoTip text="Leave empty to search the whole current week (like a normal search). Pick a date to scope to that single day."/>
                </span>
                <div className="flex">
                    <input
                        type="date"
                        value={date}
                        onChange={event => setDate(event.target.value)}
                    />
                    <button
                        type="button"
                        className="default-button default-container"
                        onClick={() => setDate('')}
                        disabled={date.length === 0}
                    >
                        Clear
                    </button>
                </div>
            </div>

            <button
                type="submit"
                className="default-button default-container explain-submit"
                disabled={isPending || !canSubmit}
            >
                {isPending ? 'Explaining…' : 'Explain'}
            </button>
        </form>
    );
};
