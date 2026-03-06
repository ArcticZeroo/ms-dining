import React, { useMemo } from 'react';
import { SearchTypes } from '@msdining/common';
import { SearchEntityFilterType } from '../../../models/search.ts';
import { getSearchTabCount } from '../../../util/search.ts';

interface IEntityFilterOption {
    type: SearchEntityFilterType;
    label: string;
}

const FILTER_OPTIONS: IEntityFilterOption[] = [
    { type: SearchEntityFilterType.all, label: 'All' },
    { type: SearchEntityFilterType.menuItem, label: 'Menu Items' },
    { type: SearchEntityFilterType.station, label: 'Stations' },
    { type: SearchEntityFilterType.cafe, label: 'Cafes' },
];

interface IMapEntityFilterDropdownProps {
    selectedType: SearchEntityFilterType;
    onSelectedTypeChanged: (type: SearchEntityFilterType) => void;
    tabCounts: Map<SearchTypes.SearchEntityType, number>;
}

export const MapEntityFilterDropdown: React.FC<IMapEntityFilterDropdownProps> = ({ selectedType, onSelectedTypeChanged, tabCounts }) => {
    const totalCount = useMemo(() => {
        let count = 0;
        for (const c of tabCounts.values()) {
            count += c;
        }
        return count;
    }, [tabCounts]);

    const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onSelectedTypeChanged(Number(event.target.value) as SearchEntityFilterType);
    };

    return (
        <select
            className="map-filter-select"
            value={selectedType}
            onChange={onChange}
        >
            {FILTER_OPTIONS.map(option => {
                const count = getSearchTabCount(option.type, tabCounts, totalCount);
                const isDisabled = option.type !== SearchEntityFilterType.all
                    && (count === 0 || count === totalCount);

                return (
                    <option
                        key={option.type}
                        value={option.type}
                        disabled={isDisabled}
                    >
                        {option.label} ({count})
                    </option>
                );
            })}
        </select>
    );
};
