import React from 'react';
import { MapSearchSortType } from '../../../models/search.ts';

interface ISortOption {
    type: MapSearchSortType;
    label: string;
    requires?: 'location' | 'homeCafes';
}

const SORT_OPTIONS: ISortOption[] = [
    { type: MapSearchSortType.relevance, label: 'Relevance' },
    { type: MapSearchSortType.price, label: 'Price (Low to High)' },
    { type: MapSearchSortType.proximity, label: 'Near Me', requires: 'location' },
    { type: MapSearchSortType.homeCafeProximity, label: 'Near My Home Cafes', requires: 'homeCafes' },
];

interface IMapSearchSortSelectorProps {
    selectedSort: MapSearchSortType;
    onSortChanged(sort: MapSearchSortType): void;
    hasUserLocation: boolean;
    hasHomeCafes: boolean;
}

export const MapSearchSortSelector: React.FC<IMapSearchSortSelectorProps> = ({ selectedSort, onSortChanged, hasUserLocation, hasHomeCafes }) => {
    const visibleOptions = SORT_OPTIONS.filter(option => {
        if (option.requires === 'location') {
            return hasUserLocation;
        }
        if (option.requires === 'homeCafes') {
            return hasHomeCafes;
        }
        return true;
    });

    const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onSortChanged(event.target.value as MapSearchSortType);
    };

    return (
        <select
            className="map-filter-select"
            value={selectedSort}
            onChange={onChange}
        >
            {visibleOptions.map(option => (
                <option key={option.type} value={option.type}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};
