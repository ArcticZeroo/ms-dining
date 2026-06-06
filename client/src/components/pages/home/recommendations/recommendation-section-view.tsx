import React, { useMemo } from 'react';
import { IRecommendationSection } from '@msdining/common/models/recommendation';
import { getOrderHistoryBoostMultiplier } from '@msdining/common/util/order-ranking';
import { RecommendationSearchResult } from './recommendation-search-result.tsx';
import { useOrderHistorySummaryQuery } from '../../../../store/queries/ordering.ts';

interface IRecommendationSectionViewProps {
    section: IRecommendationSection;
}

const applyOrderHistoryBoost = (
    items: IRecommendationSection['items'],
    countsByEntityKey: Map<string, number>,
) => {
    if (countsByEntityKey.size === 0) {
        return items;
    }

    const scored = items.map(item => ({
        item,
        score: item.score * getOrderHistoryBoostMultiplier(countsByEntityKey.get(item.entityKey) ?? 0),
    }));

    scored.sort((scoredA, scoredB) => scoredB.score - scoredA.score);
    return scored.map(({ item }) => item);
};

export const RecommendationSectionView: React.FC<IRecommendationSectionViewProps> = ({ section }) => {
    const orderHistorySummary = useOrderHistorySummaryQuery();
    const countsByEntityKey = orderHistorySummary.data?.countsById;

    const items = useMemo(
        () => countsByEntityKey ? applyOrderHistoryBoost(section.items, countsByEntityKey) : section.items,
        [section.items, countsByEntityKey],
    );

    return (
        <div className="recommendation-section-items flex horizontal-scroll">
            {items.map(item => (
                <RecommendationSearchResult
                    key={item.menuItemId}
                    item={item}
                />
            ))}
        </div>
    );
};
