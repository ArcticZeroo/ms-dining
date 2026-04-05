import {
	IRecommendationItem,
	IRecommendationSection,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { SearchEntityType } from '@msdining/common/models/search';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { IMenuItemCandidate, toRecommendationItem } from '../../../../util/recommendation.js';
import { retrieveReviewHeaderAsync } from '../../../cache/reviews.js';
import { computeCentroidSearch, computeNegativePenalties } from '../../../storage/vector/client.js';
import {
	ITEMS_PER_SECTION, IUserRecommendationContext,
	NEGATIVE_REVIEW_THRESHOLD,
	VECTOR_SEARCH_LIMIT,
} from '../../shared.js';
import { IServerReview } from '../../../../models/review.js';

/**
 * "Try Something Different" — surfaces available menu items that are maximally different
 * from everything the user has previously reviewed. Encourages culinary exploration by
 * recommending items outside the user's usual comfort zone.
 *
 * Algorithm:
 * 1. Compute a centroid embedding from all the user's reviewed items
 * 2. Search the vector space broadly from that centroid
 * 3. Rank by DESCENDING distance (most different from the centroid = highest score)
 * 4. Apply a penalty for items similar to negatively-reviewed items (rating ≤ NEGATIVE_REVIEW_THRESHOLD)
 *    to avoid recommending things similar to what the user has already disliked
 * 5. Quality-filter: only include items with no reviews or a rating ≥ 5
 * 6. Apply variety selection on the remaining pool
 *
 * Only shown to authenticated users who have at least one review.
 */
export const getTrySomethingDifferent = async (
    context: IUserRecommendationContext,
	getUserReviews: () => Promise<Array<IServerReview>>,
): Promise<IRecommendationSection | null> => {
    const allReviews = await getUserReviews();
    const reviews = allReviews.filter(review => review.menuItemId != null && review.menuItem != null);
    if (reviews.length === 0) {
        return null;
    }

    // Compute centroid and search entirely on the worker thread — no embeddings cross the boundary
    const reviewEntities = reviews.map(review => ({ entityType: SearchEntityType.menuItem, id: review.menuItemId! }));
    const results = await computeCentroidSearch(reviewEntities, SearchEntityType.menuItem, VECTOR_SEARCH_LIMIT * 3);

    if (results.length === 0) {
        return null;
    }

    const reviewedItemIds = new Set(reviews.map(review => review.menuItemId!));
    const reviewedEntityKeys = new Set(reviews.map(review => getEntityKey(review.menuItem!)));
    const availableItems = await context.getAllMenuItems();
    const availableById = new Map(availableItems.map(item => [item.menuItem.id, item]));

    // Filter to available, unreviewed items
    const candidates: Array<{ item: IMenuItemCandidate; distance: number; id: string }> = [];
    for (const result of results) {
        const item = availableById.get(result.id);
        if (!item) {
            continue;
        }
        if (reviewedItemIds.has(result.id)) {
            continue;
        }
        if (reviewedEntityKeys.has(getEntityKey(item.menuItem))) {
            continue;
        }
        candidates.push({ item, distance: result.distance, id: result.id });
    }

    // Compute negative penalties on the worker thread — all embedding lookups + distance math stay there
    const negativeReviews = reviews.filter(review => review.rating <= NEGATIVE_REVIEW_THRESHOLD);
    const negativeEntities = negativeReviews.map(review => ({ entityType: SearchEntityType.menuItem, id: review.menuItemId! }));

    let penaltiesById = new Map<string, number>();
    if (negativeEntities.length > 0) {
        const penaltyResults = await computeNegativePenalties(
            candidates.map(c => c.id),
            negativeEntities,
            SearchEntityType.menuItem,
        );
        penaltiesById = new Map(penaltyResults.map(r => [r.id, r.penaltyMultiplier]));
    }

    const scored = candidates.map(({ item, distance, id }) => ({
        item,
        score: distance * (penaltiesById.get(id) ?? 1),
    }));

    // Only include items with decent community ratings, collect a larger pool for variety
    const qualityPoolSize = ITEMS_PER_SECTION * 3;
    const topScored = scored.sort((a, b) => b.score - a.score).slice(0, qualityPoolSize);

    const headerResults = await Promise.allSettled(
        topScored.map(async ({ item }) => retrieveReviewHeaderAsync(item.menuItem))
    );

    const qualityFiltered: IRecommendationItem[] = [];
    for (let i = 0; i < topScored.length; i++) {
        const { item, score } = topScored[i]!;
        const headerResult = headerResults[i]!;

        if (headerResult.status === 'fulfilled') {
            const header = headerResult.value;
            if (header.totalReviewCount === 0 || header.overallRating >= 5) {
                qualityFiltered.push(toRecommendationItem(item, score, undefined /*reason*/, header));
            }
        } else {
            qualityFiltered.push(toRecommendationItem(item, score));
        }
    }

    return {
        type:  RecommendationSectionType.trySomethingDifferent,
        items: qualityFiltered
    };
};
