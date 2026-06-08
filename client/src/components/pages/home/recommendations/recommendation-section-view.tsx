import React from 'react';
import { IRecommendationSection } from '@msdining/common/models/recommendation';
import { RecommendationSearchResult } from './recommendation-search-result.tsx';

interface IRecommendationSectionViewProps {
    section: IRecommendationSection;
}

// Section items arrive pre-ranked from the server (applyWeights applies the
// order-history boost, review-popularity multiplier, proximity, etc. against
// fresh per-request inputs). Render in order — no client-side re-rank.
export const RecommendationSectionView: React.FC<IRecommendationSectionViewProps> = ({ section }) => {
    return (
        <div className="recommendation-section-items flex horizontal-scroll">
            {section.items.map(item => (
                <RecommendationSearchResult
                    key={item.menuItemId}
                    item={item}
                />
            ))}
        </div>
    );
};
