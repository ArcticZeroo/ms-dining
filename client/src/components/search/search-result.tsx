import { SearchTypes } from '@msdining/common';
import { SearchMatchReason } from '@msdining/common/models/search';
import React from 'react';
import { useIsSearchResultFavorite, useSearchResultCafeDetails } from '../../hooks/search-result.ts';
import { classNames } from '../../util/react.ts';
import { SearchResultInfo } from './search-result-info.tsx';
import { SearchResultTypeColumn } from './search-result-type-column.tsx';
import type { ISearchResultField } from './search-result-types.ts';
import './search.css';

export type { ISearchResultField } from './search-result-types.ts';

export interface ISearchResultProps {
    isVisible: boolean;
    name: string;
    description?: string;
    locationDatesByCafeId?: Map<string, Date[]>;
    stationByCafeId?: Map<string, string>;
    priceByCafeId?: Map<string, number>;
    imageUrl?: string;
    entityType: SearchTypes.SearchEntityType;
    extraFields?: ISearchResultField[];
    onlyShowLocationsOnDate?: Date;
    isCompact?: boolean;
    showFavoriteButton?: boolean;
    shouldColorForFavorites?: boolean;
    tags?: Set<string>;
    searchTags?: Set<string>;
    showSearchButtonInsteadOfLocations?: boolean;
    shouldStretchResults?: boolean;
    isSkeleton?: boolean;
    matchReasons?: Set<SearchMatchReason>;
    showOnlyCafeNames?: boolean;
    matchedModifiers?: Map<string, Set<string>>;
    cafeId?: string; // Should only be set for entity type cafe
    overallRating?: number;
    totalReviewCount?: number;
    /** When provided, displays an "ordered N times" badge for the current user. */
    entityKey?: string;
}

export const SearchResult: React.FC<ISearchResultProps> = ({
    isVisible,
    name,
    description,
    locationDatesByCafeId = new Map<string, Date[]>(),
    stationByCafeId = new Map<string, string>(),
    priceByCafeId = new Map<string, number>(),
    matchedModifiers = new Map<string, Set<string>>(),
    imageUrl,
    entityType,
    extraFields = [],
    onlyShowLocationsOnDate,
    isCompact = false,
    showFavoriteButton = !isCompact,
    shouldColorForFavorites = true,
    tags,
    searchTags,
    showSearchButtonInsteadOfLocations = false,
    shouldStretchResults = false,
    isSkeleton = false,
    matchReasons = new Set(),
    showOnlyCafeNames = false,
    cafeId,
    overallRating,
    totalReviewCount,
    entityKey,
}) => {
    const {
        entityView,
        description: resolvedDescription,
        hasMissingRequiredCafeView,
    } = useSearchResultCafeDetails({
        cafeId,
        description,
        entityType,
    });

    const isFavoriteItem = useIsSearchResultFavorite({
        entityType,
        entityView,
        name,
    });

    if (hasMissingRequiredCafeView) {
        console.error('SearchResult component requires entityView for entityType cafe');
        return null;
    }

    return (
        <div className={classNames(
            'search-result',
            `search-result-${entityType}`,
            isVisible && 'visible',
            isCompact && 'compact',
            shouldColorForFavorites && isFavoriteItem && 'is-favorite',
            shouldStretchResults && 'self-stretch',
            isSkeleton && 'loading-skeleton'
        )}>
            <SearchResultTypeColumn
                entityType={entityType}
                entityView={entityView}
                isCompact={isCompact}
                name={name}
                showFavoriteButton={showFavoriteButton}
            />
            <SearchResultInfo
                cafeId={cafeId}
                description={resolvedDescription}
                entityKey={entityKey}
                entityType={entityType}
                entityView={entityView}
                extraFields={extraFields}
                imageUrl={imageUrl}
                isCompact={isCompact}
                isSkeleton={isSkeleton}
                locationDatesByCafeId={locationDatesByCafeId}
                matchReasons={matchReasons}
                matchedModifiers={matchedModifiers}
                name={name}
                onlyShowLocationsOnDate={onlyShowLocationsOnDate}
                overallRating={overallRating}
                priceByCafeId={priceByCafeId}
                searchTags={searchTags}
                showFavoriteButton={showFavoriteButton}
                showOnlyCafeNames={showOnlyCafeNames}
                showSearchButtonInsteadOfLocations={showSearchButtonInsteadOfLocations}
                stationByCafeId={stationByCafeId}
                tags={tags}
                totalReviewCount={totalReviewCount}
            />
        </div>
    );
};
