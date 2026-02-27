export enum RecommendationSectionType {
    favorites = 'favorites',
    newAtFavorites = 'newAtFavorites',
    basedOnReviews = 'basedOnReviews',
    trySomethingDifferent = 'trySomethingDifferent',
    hiddenGems = 'hiddenGems',
    popular = 'popular',
}

export const RECOMMENDATION_SECTION_DISPLAY_NAMES: Record<RecommendationSectionType, string> = {
    [RecommendationSectionType.favorites]:             'Your Favorites',
    [RecommendationSectionType.newAtFavorites]:        'New at Your Favorites',
    [RecommendationSectionType.basedOnReviews]:        'Based on Your Reviews',
    [RecommendationSectionType.trySomethingDifferent]: 'Try Something Different',
    [RecommendationSectionType.hiddenGems]:            'Hidden Gems',
    [RecommendationSectionType.popular]:               'Popular Today',
};

export interface IRecommendationItem {
    menuItemId: string;
    name: string;
    description?: string;
    imageUrl?: string;
    price: number;
    calories: number;
    cafeId: string;
    cafeName: string;
    stationName: string;
    groupId?: string;
    tags?: string[];
    overallRating?: number;
    totalReviewCount?: number;
    // Why this item was recommended
    reason?: string;
    // Used for sorting within the section
    score: number;
}

export interface IRecommendationSection {
    type: RecommendationSectionType;
    title: string;
    items: IRecommendationItem[];
}

export interface IRecommendationsResponse {
    sections: IRecommendationSection[];
}
