import React, { useMemo } from 'react';
import { SearchTypes } from '@msdining/common';
import { classNames } from '../../../util/react.ts';
import { SearchEntityFilterType } from '../../../models/search.ts';
import { getSearchTabCount } from '../../../util/search.ts';
import './entity-button.css';

interface IEntityButtonProps {
    name: string;
    type: SearchEntityFilterType;
    currentFilter: SearchEntityFilterType;
    tabCounts: Map<SearchTypes.SearchEntityType, number>;
    totalResultCount: number;
    showIfEmpty?: boolean;

    onClick(): void;
}

export const EntityButton: React.FC<IEntityButtonProps> = ({
    name,
    onClick,
    type,
    currentFilter,
    totalResultCount,
    tabCounts,
    showIfEmpty = false
}) => {
    const tabCount = useMemo(
        () => getSearchTabCount(type, tabCounts, totalResultCount),
        [tabCounts, totalResultCount, type]
    );

    if (!showIfEmpty && tabCount === 0) {
        return null;
    }

    const htmlId = `entity-button-${name}`;
    const isChecked = type === currentFilter;
    const isDisabled = (type !== SearchEntityFilterType.all) && (tabCount === 0 || tabCount === totalResultCount);

    const onButtonClicked = () => {
        if (isDisabled) {
            return;
        }

        onClick();
    };

    return (
        <button className={classNames('entity-button', isChecked && 'active', isDisabled && 'disabled')}
            onClick={onButtonClicked}>
            <input type="radio"
                name="entity-type"
                id={htmlId}
                title={name}
                value={name}
                checked={isChecked}
                disabled={isDisabled}
                readOnly={true}
            />
            <label htmlFor={htmlId}>
                {name} ({tabCount})
            </label>
        </button>
    );
};