import React from 'react';
import { IQuerySearchResult } from '../../../models/search.ts';
import { SearchResult } from '../../search/search-result.tsx';

interface IMapSearchResultDetailProps {
    result: IQuerySearchResult;
    onClose(): void;
}

export const MapSearchResultDetail: React.FC<IMapSearchResultDetailProps> = ({ result, onClose }) => {
    return (
        <div className="map-result-detail-card flex">
            <SearchResult
                isVisible={true}
                name={result.name}
                description={result.description}
                locationDatesByCafeId={result.locationDatesByCafeId}
                stationByCafeId={result.stationByCafeId}
                priceByCafeId={result.priceByCafeId}
                imageUrl={result.imageUrl}
                entityType={result.entityType}
                tags={result.tags}
                searchTags={result.searchTags}
                matchReasons={result.matchReasons}
                matchedModifiers={result.matchedModifiers}
                cafeId={result.cafeId}
                showFavoriteButton={true}
                shouldStretchResults={true}
            />
            <button onClick={onClose} className="map-result-detail-collapse flex" title="Close details">
                <span className="material-symbols-outlined">chevron_left</span>
            </button>
        </div>
    );
};
