import React from 'react';
import { IQuerySearchResult } from '../../../../models/search.ts';
import { SearchResult } from '../../../search/search-result.tsx';

interface IHomeFavoriteResultProps {
    result: IQuerySearchResult;
    date: Date;
    cafeIdsOnPage: Set<string>;
}

export const HomeFavoriteResult: React.FC<IHomeFavoriteResultProps> = ({ result, date, cafeIdsOnPage }) => {
    return (
        <SearchResult
            isVisible={true}
            name={result.name}
            locationDatesByCafeId={result.locationDatesByCafeId}
            imageUrl={result.imageUrl}
            entityType={result.entityType}
            onlyShowLocationsOnDate={date}
            isCompact={true}
            showFavoriteButton={true}
            shouldColorForFavorites={false}
            cafeIdsOnPage={cafeIdsOnPage}
        />
    );
};