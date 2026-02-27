import {
	IRecommendationSection,
	IRecommendationsResponse,
} from '@msdining/common/models/recommendation';
import { deduplicateItems } from '../../util/recommendation.js';
import { lazy } from '../../util/lazy.js';
import { createSeededRandom, selectWithVariety } from '../../util/random.js';
import { ReviewStorageClient } from '../storage/clients/review.js';
import { getAnonymousSectionsAsync, getNewAtFavoritesForCafeAsync } from '../cache/recommendations.js';
import { IRecommendationContext, getAllAvailableItems, ITEMS_PER_SECTION, withErrorHandling } from './shared.js';
import { getNewAtFavorites } from './signals/user-specific/new-at-favorites.js';
import { getBasedOnReviews } from './signals/user-specific/based-on-reviews.js';
import { getTrySomethingDifferent } from './signals/user-specific/try-something-different.js';

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
 * Anonymous sections are pre-computed with a larger pool, then per-user variety selection
 * (seeded by date + userId) picks a randomized subset. All sections are deduplicated so
 * the same item doesn't appear in multiple sections.
 */
export const computeRecommendations = async (
	userId: string | null,
	dateString: string,
	homepageIds: string[],
	cafeIdFilter?: string,
): Promise<IRecommendationsResponse> => {
	const random = createSeededRandom(`${dateString}:${userId ?? 'anon'}`);

	const context: IRecommendationContext = {
		userId,
		dateString,
		homepageIds,
		cafeIdFilter,
		random,
		getAvailableItems:  lazy(() => getAllAvailableItems(dateString, cafeIdFilter)),
		getUserReviews:     lazy(() => userId
			? ReviewStorageClient.getReviewsForUserAsync({ userId })
			: Promise.resolve([])),
		getNewItemsForCafe: (cafeId) => getNewAtFavoritesForCafeAsync(cafeId, dateString),
	};

	// Fetch anonymous sections (cached) and user-specific sections in parallel
	const anonymousSectionsPromise = getAnonymousSectionsAsync(dateString, cafeIdFilter);

	const sectionPromises: Array<Promise<IRecommendationSection | null>> = [];

	if (homepageIds.length > 0 || cafeIdFilter) {
		sectionPromises.push(withErrorHandling('newAtFavorites', getNewAtFavorites(context)));
	}

	if (userId) {
		sectionPromises.push(withErrorHandling('basedOnReviews', getBasedOnReviews(context)));
		sectionPromises.push(withErrorHandling('trySomethingDifferent', getTrySomethingDifferent(context)));
	}

	const [anonymousSections, userResults] = await Promise.all([
		anonymousSectionsPromise,
		Promise.all(sectionPromises),
	]);

	// Apply per-user variety to the anonymous pool sections
	const userAnonymousSections = anonymousSections.map(section => ({
		...section,
		items: selectWithVariety(section.items, ITEMS_PER_SECTION, random),
	}));

	const userSections = userResults.filter((section): section is IRecommendationSection => section != null);

	// new-at-favorites first, then user-specific, then anonymous
	const allSections = [...userSections, ...userAnonymousSections];

	return { sections: deduplicateItems(allSections) };
};
