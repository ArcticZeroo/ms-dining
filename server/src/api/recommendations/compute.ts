import {
	IRecommendationItem,
	IRecommendationSection,
	IRecommendationsResponse,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { throwError } from '../../util/error.js';
import { lazy } from '../../util/lazy.js';
import { buildProximityWeightMap } from '../../util/proximity.js';
import { createSeededRandom, selectWithVariety } from '../../util/random.js';
import { deduplicateItems } from '../../util/recommendation.js';
import { ReviewStorageClient } from '../storage/clients/review.js';
import { getHiddenGems } from './signals/anonymous/hidden-gems.js';
import { getPopularItems } from './signals/anonymous/popular.js';
import { getBasedOnReviews } from './signals/user-specific/based-on-reviews.js';
import { getNewAtFavorites } from './signals/user-specific/new-at-favorites.js';
import { getTrySomethingDifferent } from './signals/user-specific/try-something-different.js';
import { getAllAvailableItems, IRecommendationContext, ITEMS_PER_SECTION, withErrorHandling } from './shared.js';

// --- Proximity helpers ---

const applyProximityToItems = (items: IRecommendationItem[], proximityWeights: Map<string, number> | null): IRecommendationItem[] => {
    if (!proximityWeights) {
        return items;
    }

    const resultItems: IRecommendationItem[] = [];
    let isAnyWeightNotDefault = false;
    for (const item of items) {
        const weight = proximityWeights.get(item.cafeId) ?? 1;
        if (weight > 0) {
            resultItems.push({
                ...item,
                score: item.score * weight,
            });
        }

        if (weight !== 1) {
            isAnyWeightNotDefault = true;
        }
    }

    if (isAnyWeightNotDefault) {
        resultItems.sort((itemA, itemB) => itemB.score - itemA.score);
    }

    return resultItems;
}

const PROXIMITY_EXEMPT_SECTION_TYPES = new Set<RecommendationSectionType>([
    RecommendationSectionType.newAtFavorites,
    RecommendationSectionType.favorites,
]);

const proximityAdjustUserSections = (sections: Array<IRecommendationSection | null>, proximityWeights: Map<string, number> | null): IRecommendationSection[] => {
    if (!proximityWeights) {
        return sections.filter((section): section is IRecommendationSection => section != null);
    }

    const adjustedSections: IRecommendationSection[] = [];
    for (const section of sections) {
        if (!section) {
            continue;
        }

        if (PROXIMITY_EXEMPT_SECTION_TYPES.has(section.type)) {
            adjustedSections.push(section);
            continue;
        }

        const adjustedItems = applyProximityToItems(section.items, proximityWeights);
        if (adjustedItems.length > 0) {
            adjustedSections.push({
                ...section,
                items: adjustedItems,
            });
        }
    }

    return adjustedSections;
}

// --- Context building ---

type BuildContextParams = Pick<IRecommendationContext, 'userId' | 'dateString' | 'homepageIds' | 'cafeIdFilter' | 'getNewItemsForCafe'>;

const buildContext = ({
    userId = null,
    dateString,
    homepageIds,
    cafeIdFilter,
    getNewItemsForCafe,
}: BuildContextParams): IRecommendationContext => {
    const random = createSeededRandom(`${dateString}:${userId ?? 'anon'}`);

    return {
        userId,
        dateString,
        homepageIds,
        cafeIdFilter,
        random,
        getAllMenuItems:    lazy(() => getAllAvailableItems(dateString, cafeIdFilter)),
        getUserReviews:     lazy(() => userId
            ? ReviewStorageClient.getReviewsForUserAsync({ userId })
            : Promise.resolve([])),
        getNewItemsForCafe,
    } satisfies IRecommendationContext;
}

// --- Anonymous sections computation ---

/**
 * Computes the anonymous recommendation sections (Popular Today, Hidden Gems).
 * These are user-independent and can be cached globally.
 */
export const computeAnonymousSections = async (dateString: string, cafeIdFilter?: string): Promise<IRecommendationSection[]> => {
    const context = buildContext({
        userId:             null,
		homepageIds:        [],
		getNewItemsForCafe: () => throwError('getNewItemsForCafe should not be called for anonymous recommendations'),
        dateString,
        cafeIdFilter,
    });

    const results = await Promise.all([
        withErrorHandling('popular', getPopularItems(context)),
        withErrorHandling('hiddenGems', getHiddenGems(context)),
    ]);

    return results.filter((section): section is IRecommendationSection => section != null);
};

// --- Main computation ---

/**
 * Computes the full recommendations response for a user by assembling sections from
 * multiple signals. There are two categories of sections:
 *
 * **Anonymous sections** (cached globally, shown to all users):
 * - "Popular Today" — highest-rated items by community reviews
 * - "Hidden Gems" — under-reviewed items similar to top-rated ones
 *
 * **User-specific sections** (computed per-request):
 * - "New at Your Favorites" — new/rotating/traveling items at the user's homepage cafes
 * - "Based on Your Reviews" — items similar to things the user rated highly
 * - "Try Something Different" — items maximally different from the user's review history
 *
 * Anonymous sections are pre-computed as a full pool, then per-user variety selection
 * (seeded by date + userId) picks a randomized subset. All sections are deduplicated so
 * the same item doesn't appear in multiple sections.
 *
 * When homepage views are set (and no single-cafe filter), proximity weighting
 * deprioritizes items from distant cafes and excludes those beyond the max distance.
 */
interface IComputeRecommendationsParams {
    anonymousSections: IRecommendationSection[];
    userId: string | null;
    dateString: string;
    homepageIds: string[];
    cafeIdFilter?: string;
    getNewItemsForCafe: (cafeId: string) => Promise<IRecommendationItem[]>;
}

export const computeRecommendations = async ({
    anonymousSections,
    userId,
    dateString,
    homepageIds,
    cafeIdFilter,
    getNewItemsForCafe,
}: IComputeRecommendationsParams): Promise<IRecommendationsResponse> => {
    const context = buildContext({ userId, dateString, homepageIds, cafeIdFilter, getNewItemsForCafe });

    const sectionPromises: Array<Promise<IRecommendationSection | null>> = [];

    if (homepageIds.length > 0 || cafeIdFilter) {
        sectionPromises.push(withErrorHandling('newAtFavorites', getNewAtFavorites(context)));
    }

    if (userId) {
        sectionPromises.push(withErrorHandling('basedOnReviews', getBasedOnReviews(context)));
        sectionPromises.push(withErrorHandling('trySomethingDifferent', getTrySomethingDifferent(context)));
    }

    const userResults = await Promise.all(sectionPromises);

    // Apply proximity weighting when homepage views are set and no single-cafe filter
    const proximityWeights = buildProximityWeightMap(homepageIds, cafeIdFilter);

    // Apply per-user variety to the anonymous pool sections.
    // When proximity weights are available, apply them before variety selection
    // so that distant items are removed/deprioritized before picking the final subset.
    const userAnonymousSections = anonymousSections.map(section => {
        const proximityAdjustedItems = applyProximityToItems(section.items, proximityWeights);

        return {
            ...section,
            items: selectWithVariety(proximityAdjustedItems, ITEMS_PER_SECTION, context.random),
        };
    });

    const userSections = proximityAdjustUserSections(userResults, proximityWeights);

    // new-at-favorites first, then user-specific, then anonymous
    const allSections = [...userSections, ...userAnonymousSections];

    return { sections: deduplicateItems(allSections) };
};
