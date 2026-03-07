import {
	IRecommendationItem,
	IRecommendationSection,
	RecommendationSectionType,
	RECOMMENDATION_SECTION_DISPLAY_NAMES,
} from '@msdining/common/models/recommendation';
import { SearchEntityType } from '@msdining/common/models/search';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { IMenuItemCandidate, toRecommendationItem } from '../../../../util/recommendation.js';
import { selectWithVariety, weightedRandomSample } from '../../../../util/random.js';
import { retrieveReviewHeaderAsync } from '../../../cache/reviews.js';
import {
	searchSimilarEntitiesByType,
} from '../../../storage/vector/client.js';
import {
	IRecommendationContext,
	log,
	ITEMS_PER_SECTION,
	POSITIVE_REVIEW_THRESHOLD,
	VECTOR_SEARCH_LIMIT,
} from '../../shared.js';

/**
 * "Based on Your Reviews" — finds available menu items that are semantically similar to
 * items the user has positively reviewed (rating ≥ POSITIVE_REVIEW_THRESHOLD). Helps users
 * find new things they're likely to enjoy based on their demonstrated preferences.
 *
 * Algorithm:
 * 1. Filter the user's reviews to only positive ones
 * 2. Weighted-random-sample up to 3 positive reviews as seeds (weighted by rating)
 * 3. For each seed, vector search for similar available items (excluding already-reviewed items)
 * 4. Rank by vector distance, then apply variety selection to avoid clustering
 * 5. Attach review headers (community ratings) to the final results
 *
 * Only shown to authenticated users who have at least one positive review.
 */
export const getBasedOnReviews = async (
	context: IRecommendationContext,
): Promise<IRecommendationSection | null> => {
	const allReviews = await context.getUserReviews();
	const reviews = allReviews.filter(review => review.menuItemId != null && review.menuItem != null);
	const positiveReviews = reviews.filter(review => review.rating >= POSITIVE_REVIEW_THRESHOLD);

	if (positiveReviews.length === 0) {
		return null;
	}

	const reviewedItemIds = new Set(reviews.map(review => review.menuItemId!));
	const reviewedEntityKeys = new Set(reviews.map(review => getEntityKey(review.menuItem!)));

	const allMenuItems = await context.getAllMenuItems();
	const unreviewedMenuItemsByEntityKey = new Map<string, IMenuItemCandidate>();
	const unreviewedMenuItemsById = new Map<string, IMenuItemCandidate>();
	for (const item of allMenuItems) {
		const entityKey = getEntityKey(item.menuItem);
		if (!reviewedItemIds.has(item.menuItem.id) && !reviewedEntityKeys.has(entityKey)) {
			unreviewedMenuItemsByEntityKey.set(entityKey, item);
			unreviewedMenuItemsById.set(item.menuItem.id, item);
		}
	}

	if (unreviewedMenuItemsByEntityKey.size === 0) {
		return null;
	}

	// Pick up to 3 positive reviews using weighted random sampling (weight = rating)
	const selectedReviews = weightedRandomSample(
		positiveReviews.map(review => ({ value: review, weight: review.rating })),
		3,
		context.random,
	);

	const candidates = new Map<string, { item: IRecommendationItem; distance: number }>();

	// Vector search from each seed in parallel
	const searchResults = await Promise.all(
		selectedReviews.map(async (review) => {
			try {
				return {
					review,
					results: await searchSimilarEntitiesByType(SearchEntityType.menuItem, review.menuItemId!, VECTOR_SEARCH_LIMIT),
				};
			} catch (error) {
				log.error('Error finding similar items for review:', error);
				return { review, results: [] };
			}
		})
	);

	for (const { review, results } of searchResults) {
		for (const result of results) {
			const menuItem = unreviewedMenuItemsById.get(result.id);
			if (!menuItem) {
				continue;
			}

			const entityKey = getEntityKey(menuItem.menuItem);
			const existing = candidates.get(entityKey);
			if (!existing || result.distance < existing.distance) {
				candidates.set(entityKey, {
					item:     toRecommendationItem(
						menuItem,
						1 - result.distance,
						`Similar to ${review.menuItem!.name}`,
					),
					distance: result.distance,
				});
			}
		}
	}

	const sortedCandidates = Array.from(candidates.values()).sort((a, b) => a.distance - b.distance);
	const selectedCandidates = selectWithVariety(sortedCandidates, ITEMS_PER_SECTION, context.random);

	const items = await Promise.all(
		selectedCandidates.map(async ({ item }) => {
			try {
				const entityKey = getEntityKey(item);
				const candidate = unreviewedMenuItemsByEntityKey.get(entityKey);
				const header = candidate
					? await retrieveReviewHeaderAsync(candidate.menuItem).catch(() => null)
					: null;
				return { ...item, overallRating: header?.overallRating, totalReviewCount: header?.totalReviewCount };
			} catch {
				return item;
			}
		})
	);

	if (items.length === 0) {
		return null;
	}

	return {
		type:  RecommendationSectionType.basedOnReviews,
		title: RECOMMENDATION_SECTION_DISPLAY_NAMES[RecommendationSectionType.basedOnReviews],
		items,
	};
};
