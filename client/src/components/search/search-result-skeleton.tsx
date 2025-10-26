import { ISearchResultProps, SearchResult } from './search-result.tsx';
import { SearchEntityType } from '@msdining/common/models/search';
import React from 'react';

type SearchResultSkeletonProps = Omit<Partial<ISearchResultProps>, 'isSkeleton'>;

export const SearchResultSkeleton: React.FC<SearchResultSkeletonProps> = ({ showFavoriteButton, shouldStretchResults, isCompact, showSearchButtonInsteadOfLocations }) => (
    <SearchResult
        name="..."
        entityType={SearchEntityType.menuItem}
        isCompact={isCompact}
        isVisible={true}
        isSkeleton={true}
        shouldStretchResults={shouldStretchResults}
        showFavoriteButton={showFavoriteButton}
        showSearchButtonInsteadOfLocations={showSearchButtonInsteadOfLocations}
        locationDatesByCafeId={new Map([
            ['...', [new Date()]]
        ])}
    />
)