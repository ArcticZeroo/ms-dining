import React, { useMemo } from 'react';

import { classNames } from '../../../util/react.ts';
import { SearchEntityFilterType, SearchEntityType } from '../../../models/search.ts';

interface IEntityButtonProps {
    name: string;
    type: SearchEntityFilterType;
    currentFilter: SearchEntityFilterType;
    tabCounts: Map<SearchEntityType, number>;
    totalResultCount: number;

    onClick(): void;
}

export const EntityButton: React.FC<IEntityButtonProps> = ({
                                                               name,
                                                               onClick,
                                                               type,
                                                               currentFilter,
                                                               totalResultCount,
                                                               tabCounts
                                                           }) => {
    const tabCount = useMemo(() => {
        if (type === SearchEntityFilterType.all) {
            return totalResultCount;
        }

        if (type === SearchEntityFilterType.menuItem) {
            return tabCounts.get(SearchEntityType.menuItem) ?? 0;
        }

        if (type === SearchEntityFilterType.station) {
            return tabCounts.get(SearchEntityType.station) ?? 0;
        }

        return 0;
    }, [tabCounts, totalResultCount, type]);

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
        <button className={classNames('entity-button', isChecked && 'active', isDisabled && 'disabled')} onClick={onButtonClicked}>
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
}