import React, { useMemo } from 'react';
import { SearchEntityType } from '@msdining/common/models/search';
import { IRecommendationItem } from '@msdining/common/models/recommendation';
import { SearchResult, ISearchResultField } from '../../../search/search-result.tsx';

interface IRecommendationSearchResultProps {
    item: IRecommendationItem;
}

export const RecommendationSearchResult: React.FC<IRecommendationSearchResultProps> = ({ item }) => {
    const locationDatesByCafeId = useMemo(
        () => new Map([[item.cafeId, [] as Date[]]]),
        [item.cafeId]
    );

    const priceByCafeId = useMemo(
        () => item.price > 0 ? new Map([[item.cafeId, item.price]]) : new Map<string, number>(),
        [item.cafeId, item.price]
    );

    const stationByCafeId = useMemo(
        () => new Map([[item.cafeId, item.stationName]]),
        [item.cafeId, item.stationName]
    );

    const tags = useMemo(
        () => item.tags ? new Set(item.tags) : undefined,
        [item.tags]
    );

    const extraFields = useMemo(() => {
        const fields: ISearchResultField[] = [];
        if (item.reason) {
            fields.push({
                key:      'reason',
                iconName: 'lightbulb',
                value:    item.reason,
            });
        }
        return fields;
    }, [item.reason]);

    return (
        <SearchResult
            isVisible={true}
            name={item.name}
            imageUrl={item.imageUrl}
            entityType={SearchEntityType.menuItem}
            locationDatesByCafeId={locationDatesByCafeId}
            priceByCafeId={priceByCafeId}
            stationByCafeId={stationByCafeId}
            tags={tags}
            isCompact={true}
            showFavoriteButton={true}
            shouldColorForFavorites={false}
            showOnlyCafeNames={true}
            overallRating={item.overallRating}
            totalReviewCount={item.totalReviewCount}
            extraFields={extraFields}
        />
    );
};
