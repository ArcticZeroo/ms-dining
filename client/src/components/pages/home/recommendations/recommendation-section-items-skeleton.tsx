import React from 'react';
import { SearchResultSkeleton } from '../../../search/search-result-skeleton.tsx';

const SKELETON_CARD_COUNT = 4;

export const RecommendationSectionItemsSkeleton: React.FC = () => (
    <div className="recommendation-section-items flex horizontal-scroll loading-skeleton">
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            <SearchResultSkeleton
                key={index}
                isCompact={true}
                showFavoriteButton={true}
            />
        ))}
    </div>
);