import { ISearchResultProps, SearchResult } from './search-result.tsx';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import React from 'react';

type SearchResultSkeletonProps = Omit<Partial<ISearchResultProps>, 'isSkeleton'>;

export const SearchResultSkeleton: React.FC<SearchResultSkeletonProps> = ({ shouldStretchResults, isCompact, showSearchButtonInsteadOfLocations }) => (
    <SearchResult
        name="..."
        description="..."
        entityType={SearchEntityType.menuItem}
        isCompact={isCompact}
        isVisible={true}
        isSkeleton={true}
        shouldStretchResults={shouldStretchResults}
        showFavoriteButton={false}
        showSearchButtonInsteadOfLocations={showSearchButtonInsteadOfLocations}
    />
)