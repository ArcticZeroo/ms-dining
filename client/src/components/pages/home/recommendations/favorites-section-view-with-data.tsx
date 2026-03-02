import React from 'react';
import { IQuerySearchResult } from '../../../../models/search.ts';
import { SearchResult } from '../../../search/search-result.tsx';

interface IFavoritesSectionViewWithDataProps {
    results: IQuerySearchResult[];
}

export const FavoritesSectionViewWithData: React.FC<IFavoritesSectionViewWithDataProps> = ({ results }) => {
    return (
        <div className="recommendation-section-items flex horizontal-scroll">
            {results.map(result => (
                <SearchResult
                    key={result.name}
                    isVisible={true}
                    name={result.name}
                    imageUrl={result.imageUrl}
                    entityType={result.entityType}
                    locationDatesByCafeId={result.locationDatesByCafeId}
                    priceByCafeId={result.priceByCafeId}
                    stationByCafeId={result.stationByCafeId}
                    tags={result.tags}
                    isCompact={true}
                    showFavoriteButton={true}
                    shouldColorForFavorites={false}
                    showOnlyCafeNames={true}
                    overallRating={result.overallRating}
                    totalReviewCount={result.totalReviewCount}
                />
            ))}
        </div>
    );
};
