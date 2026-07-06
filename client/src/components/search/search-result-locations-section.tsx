import { SearchTypes } from '@msdining/common';
import React from 'react';
import { useSearchResultLocationState } from '../../hooks/search-result.ts';
import { SearchResultFindButton } from './search-result-find-button.tsx';
import { SearchResultHits } from './search-result-hits.tsx';
import { SearchResultHitsSkeleton } from './skeleton/search-result-hits-skeleton.tsx';

interface ISearchResultLocationsSectionProps {
    entityType: SearchTypes.SearchEntityType;
    isCompact: boolean;
    isSkeleton: boolean;
    locationDatesByCafeId: Map<string, Date[]>;
    name: string;
    onlyShowLocationsOnDate?: Date;
    priceByCafeId: Map<string, number>;
    showOnlyCafeNames: boolean;
    showSearchButtonInsteadOfLocations: boolean;
    stationByCafeId: Map<string, string>;
}

export const SearchResultLocationsSection: React.FC<ISearchResultLocationsSectionProps> = ({
    entityType,
    isCompact,
    isSkeleton,
    locationDatesByCafeId,
    name,
    onlyShowLocationsOnDate,
    priceByCafeId,
    showOnlyCafeNames,
    showSearchButtonInsteadOfLocations,
    stationByCafeId,
}) => {
    const {
        locationEntriesInOrder,
        resolvedOnlyShowLocationsOnDate,
        shouldShowLocationDates,
    } = useSearchResultLocationState({
        locationDatesByCafeId,
        onlyShowLocationsOnDate,
    });

    if (showSearchButtonInsteadOfLocations) {
        return (
            <SearchResultFindButton
                name={name}
                isSkeleton={isSkeleton}
                cafeCount={locationEntriesInOrder.length}
            />
        );
    }

    if (isSkeleton) {
        return <SearchResultHitsSkeleton/>;
    }

    return (
        <SearchResultHits
            name={name}
            entityType={entityType}
            onlyShowLocationsOnDate={resolvedOnlyShowLocationsOnDate}
            isCompact={isCompact}
            locationEntriesInOrder={locationEntriesInOrder}
            shouldShowLocationDates={shouldShowLocationDates}
            priceByCafeId={priceByCafeId}
            stationByCafeId={stationByCafeId}
            showOnlyCafeNames={showOnlyCafeNames}
        />
    );
};
