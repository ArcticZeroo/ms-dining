import { z } from 'zod';

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
    [RecommendationSectionType.newAtFavorites]:        'At Your Cafes',
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
    items: IRecommendationItem[];
}

export interface IRecommendationsResponse {
    sections: IRecommendationSection[];
}

export const RecommendationSectionTypeSchema = z.nativeEnum(RecommendationSectionType);

export const RecommendationItemSchema = z.object({
    menuItemId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    price: z.number(),
    calories: z.number(),
    cafeId: z.string(),
    cafeName: z.string(),
    stationName: z.string(),
    groupId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    overallRating: z.number().optional(),
    totalReviewCount: z.number().optional(),
    reason: z.string().optional(),
    score: z.number(),
});

export const RecommendationSectionSchema = z.object({
    type: RecommendationSectionTypeSchema,
    items: z.array(RecommendationItemSchema)
})

export const RecommendationsResponseSchema = z.object({
    sections: z.array(RecommendationSectionSchema)
});
