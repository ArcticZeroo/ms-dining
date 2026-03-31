import React from 'react';
import { IRecommendationItem } from '@msdining/common/models/recommendation';
import { classNames } from '../../../util/react.ts';
import { RecommendationSearchResult } from '../home/recommendations/recommendation-search-result.js';

interface IMapOverviewFeaturedPanelProps {
    featuredItems: IRecommendationItem[];
    isDocked?: boolean;
}

export const MapOverviewFeaturedPanel: React.FC<IMapOverviewFeaturedPanelProps> = ({ featuredItems, isDocked = false }) => {
    if (featuredItems.length === 0) {
        return null;
    }

    return (
        <div className={classNames('overview-featured flex-col', isDocked && 'map-result-detail-card map-overview-featured-card')}>
            <span className="featured-panel-title">Featured Items</span>
            <div className="overview-featured-items flex horizontal-scroll">
                {featuredItems.map(item => (
                    <RecommendationSearchResult key={item.menuItemId} item={item}/>
                ))}
            </div>
        </div>
    );
};
