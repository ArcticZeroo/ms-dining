import {
	IRecommendationItem,
	IRecommendationSection,
	RECOMMENDATION_SECTION_DISPLAY_NAMES,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { SearchEntityType } from '@msdining/common/models/search';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { IMenuItemCandidate, toRecommendationItem } from '../../../../util/recommendation.js';
import { selectWithVariety } from '../../../../util/random.js';
import { retrieveReviewHeaderAsync } from '../../../cache/reviews.js';
import { getSearchEntityEmbedding, searchVectorRawByType, } from '../../../storage/vector/client.js';
import {
	IRecommendationContext,
	ITEMS_PER_SECTION,
	NEGATIVE_REVIEW_THRESHOLD,
	VECTOR_SEARCH_LIMIT,
} from '../../shared.js';

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
    context: IRecommendationContext,
): Promise<IRecommendationSection | null> => {
    const allReviews = await context.getUserReviews();
    const reviews = allReviews.filter(review => review.menuItemId != null && review.menuItem != null);
    if (reviews.length === 0) {
        return null;
    }

    // Compute centroid of all reviewed items' embeddings (parallel)
    const embeddingResults = await Promise.all(
        reviews.map(async (review) => {
            try {
                return await getSearchEntityEmbedding(SearchEntityType.menuItem, review.menuItemId!);
            } catch {
                return null;
            }
        })
    );
    const embeddings = embeddingResults.filter((embedding): embedding is Float32Array => embedding != null);

    if (embeddings.length === 0) {
        return null;
    }

    const dim = embeddings[0]!.length;
    const centroid = new Float32Array(dim);
    for (const embedding of embeddings) {
        for (let i = 0; i < dim; i++) {
			centroid[i]! += embedding[i]!;
        }
    }
    for (let i = 0; i < dim; i++) {
		centroid[i]! /= embeddings.length;
    }

    // Search broadly from the centroid, then take items with LARGEST distance
    const results = await searchVectorRawByType(centroid, SearchEntityType.menuItem, VECTOR_SEARCH_LIMIT * 3);

    const reviewedItemIds = new Set(reviews.map(review => review.menuItemId!));
    const reviewedEntityKeys = new Set(reviews.map(review => getEntityKey(review.menuItem!)));
    const availableItems = await context.getAllMenuItems();
    const availableById = new Map(availableItems.map(item => [item.menuItem.id, item]));

    // Negatively-reviewed item embeddings for penalty (parallel)
    const negativeReviews = reviews.filter(review => review.rating <= NEGATIVE_REVIEW_THRESHOLD);
    const negativeEmbeddingResults = await Promise.all(
        negativeReviews.map(async (review) => {
            try {
                return await getSearchEntityEmbedding(SearchEntityType.menuItem, review.menuItemId!);
            } catch {
                return null;
            }
        })
    );
    const negativeEmbeddings = negativeEmbeddingResults.filter((embedding): embedding is Float32Array => embedding != null);

    // Sort by DESCENDING distance from centroid (most different first)
    // Apply penalty for similarity to negatively-reviewed items
    const scored: Array<{ item: IMenuItemCandidate; score: number }> = [];
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

        let score = result.distance; // Higher distance = more different = better

        // Penalize items similar to negatively-reviewed items
        if (negativeEmbeddings.length > 0) {
            const itemEmbedding = await getSearchEntityEmbedding(SearchEntityType.menuItem, result.id);
            if (itemEmbedding) {
                for (const negEmb of negativeEmbeddings) {
                    let dist = 0;
                    for (let i = 0; i < itemEmbedding.length; i++) {
                        const d = (itemEmbedding[i] ?? 0) - (negEmb[i] ?? 0);
                        dist += d * d;
                    }
                    dist = Math.sqrt(dist);
                    // Penalize if close to a negatively-reviewed item
                    if (dist < 0.5) {
                        score *= 0.5;
                    }
                }
            }
        }

        scored.push({ item, score });
    }

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

    const filtered = selectWithVariety(qualityFiltered, ITEMS_PER_SECTION, context.random);

    if (filtered.length === 0) {
        return null;
    }

    return {
        type:  RecommendationSectionType.trySomethingDifferent,
        title: RECOMMENDATION_SECTION_DISPLAY_NAMES[RecommendationSectionType.trySomethingDifferent],
        items: filtered,
    };
};
