import React from 'react';
import { IRecommendationItem } from '@msdining/common/models/recommendation';
import { DeviceType, useDeviceType } from '../../../hooks/media-query.ts';
import { RecommendationSearchResult } from '../home/recommendations/recommendation-search-result.js';

interface IMapOverviewFeaturedPanelProps {
    featuredItems: IRecommendationItem[];
}

export const MapOverviewFeaturedPanel: React.FC<IMapOverviewFeaturedPanelProps> = ({ featuredItems }) => {
    const deviceType = useDeviceType();

    if (featuredItems.length === 0) {
        return null;
    }

    if (deviceType === DeviceType.Desktop) {
        return (
            <div className="map-result-detail-card map-overview-featured-card flex-col">
                <div className="featured-panel-header flex">
                    <span className="featured-panel-title">Featured Items</span>
                </div>
                <div className="featured-panel-items flex horizontal-scroll">
                    {featuredItems.map(item => (
                        <RecommendationSearchResult key={item.menuItemId} item={item}/>
                    ))}
                </div>
            </div>
        );
    }

    // Mobile: horizontal scroll inline
    return (
        <div className="overview-featured-mobile flex-col">
            <span className="featured-panel-title">Featured Items</span>
            <div className="flex horizontal-scroll">
                {featuredItems.map(item => (
                    <RecommendationSearchResult key={item.menuItemId} item={item}/>
                ))}
            </div>
        </div>
    );
};
