import React from 'react';
import { IRecommendationSection } from '@msdining/common/models/recommendation';
import { RecommendationSearchResult } from './recommendation-search-result.tsx';

interface IRecommendationSectionViewProps {
    section: IRecommendationSection;
}

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
