import Duration from '@arcticzeroo/duration';
import {
	IRecommendationItem,
	IRecommendationSection,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { setInterval } from 'node:timers';
import { isDateStringWithinMenuWindow } from '../../util/date.js';
import { logError } from '../../util/log.js';
import { LockedExpiringMap } from '../lock/map.js';
import { getNewAtCafe } from '../recommendations/signals/cafe-specific/new-items.js';
import { CAFES_BY_ID } from '../../constants/cafes.js';
import { getAllAvailableItems, IRecommendationContext } from '../recommendations/shared.js';
import { createSeededRandom } from '../../util/random.js';
import { lazy } from '../../util/lazy.js';
import { ReviewStorageClient } from '../storage/clients/review.js';
import { getPopularItems } from '../recommendations/signals/cafe-specific/popular.js';
import { getHiddenGems } from '../recommendations/signals/cafe-specific/hidden-gems.js';
import { getBasedOnReviews } from '../recommendations/signals/user-specific/based-on-reviews.js';
import { getTrySomethingDifferent } from '../recommendations/signals/user-specific/try-something-different.js';
import { buildProximityWeightMap } from '../../util/proximity.js';
import { assembleSections } from '../recommendations/compute.js';

const GLOBAL_RECOMMENDATION_SECTIONS_CACHE = new Map<string /*dateString*/, LockedExpiringMap<string /*cafeId*/, Map<RecommendationSectionType, Array<IRecommendationItem>>>>();
const USER_RECOMMENDATION_SECTIONS_CACHE = new Map<string /*dateString*/, Map<string /*cafeId*/, LockedExpiringMap<string /*userId*/, Map<RecommendationSectionType, Array<IRecommendationItem>>>>>();

const RECOMMENDATIONS_CACHE_EXPIRATION = new Duration({ minutes: 30 });
const RECOMMENDATIONS_CACHE_CLEANUP_INTERVAL = new Duration({ hours: 12 });

const ensureGlobalCacheForDateString = (dateString: string) => {
	if (!GLOBAL_RECOMMENDATION_SECTIONS_CACHE.has(dateString)) {
		const cache = new LockedExpiringMap<string, Map<RecommendationSectionType, Array<IRecommendationItem>>>(RECOMMENDATIONS_CACHE_EXPIRATION);
		GLOBAL_RECOMMENDATION_SECTIONS_CACHE.set(dateString, cache);
	}

	return GLOBAL_RECOMMENDATION_SECTIONS_CACHE.get(dateString)!;
}

const ensureUserCacheForDateString = (dateString: string, cafeId: string) => {
	if (!USER_RECOMMENDATION_SECTIONS_CACHE.has(dateString)) {
		const cache = new Map<string, LockedExpiringMap<string, Map<RecommendationSectionType, Array<IRecommendationItem>>>>();
		USER_RECOMMENDATION_SECTIONS_CACHE.set(dateString, cache);
	}

	const cacheForDateString = USER_RECOMMENDATION_SECTIONS_CACHE.get(dateString)!;
	if (!cacheForDateString.has(cafeId)) {
		cacheForDateString.set(cafeId, new LockedExpiringMap<string, Map<RecommendationSectionType, Array<IRecommendationItem>>>(RECOMMENDATIONS_CACHE_EXPIRATION));
	}

	return cacheForDateString.get(cafeId)!;
}

type BuildContextParams = Pick<IRecommendationContext, 'userId' | 'dateString' | 'homepageIds' | 'cafeId' | 'random'>;

const buildContext = ({
						  userId = null,
						  dateString,
						  homepageIds,
						  cafeId,
						  random
					  }: BuildContextParams): IRecommendationContext => {
	return {
		userId,
		dateString,
		homepageIds,
		cafeId,
		random,
		getAllMenuItems: lazy(() => getAllAvailableItems(dateString, cafeId)),
		getUserReviews:  lazy(() => userId
			? ReviewStorageClient.getReviewsForUserAsync({ userId })
			: Promise.resolve([]))
	} satisfies IRecommendationContext;
};

const insertIfSucceeded = async (map: Map<RecommendationSectionType, Array<IRecommendationItem>>, resultPromise: Promise<IRecommendationSection | null>) => {
	try {
		const result = await resultPromise;
		if (result && result.items.length > 0) {
			map.set(result.type, result.items);
		}
	} catch (error) {
		logError('Error computing section', error);
	}
}

const getRecommendationsForCafe = async (context: IRecommendationContext): Promise<Map<RecommendationSectionType, Array<IRecommendationItem>>> => {
	const cacheForDateString = ensureGlobalCacheForDateString(context.dateString);
	return cacheForDateString.getOrInsert(context.cafeId, async () => {
		const recommendations = new Map<RecommendationSectionType, Array<IRecommendationItem>>();

		await Promise.all([
			insertIfSucceeded(recommendations, getPopularItems(context)),
			insertIfSucceeded(recommendations, getHiddenGems(context)),
			insertIfSucceeded(recommendations, getNewAtCafe(context)),
		]);

		return recommendations;
	});
}

const getRecommendationsForUser = async (context: IRecommendationContext): Promise<Map<RecommendationSectionType, Array<IRecommendationItem>>> => {
	if (!context.userId) {
		return new Map();
	}

	const cacheForDateString = ensureUserCacheForDateString(context.dateString, context.cafeId);
	return cacheForDateString.getOrInsert(context.userId, async () => {
		const recommendations = new Map<RecommendationSectionType, Array<IRecommendationItem>>();

		await Promise.all([
			insertIfSucceeded(recommendations, getBasedOnReviews(context)),
			insertIfSucceeded(recommendations, getTrySomethingDifferent(context)),
		]);

		return recommendations;
	});
}

const addToRecommendations = (existing: Map<RecommendationSectionType, Array<IRecommendationItem>>, additions: Map<RecommendationSectionType, Array<IRecommendationItem>>) => {
	for (const [sectionType, items] of additions) {
		const existingItems = existing.get(sectionType) ?? [];
		existingItems.push(...items);
		existing.set(sectionType, existingItems);
	}
}

interface IGetRecommendationsParams {
	userId: string | null;
	dateString: string;
	homepageIds: string[];
	favoriteItemNames: string[];
	cafeIdFilter?: Set<string>;
}

export const getRecommendationsAsync = async ({
												  userId,
												  dateString,
												  homepageIds,
												  favoriteItemNames,
												  cafeIdFilter,
											  }: IGetRecommendationsParams): Promise<Array<IRecommendationSection>> => {
	if (!isDateStringWithinMenuWindow(dateString)) {
		return [];
	}

	const random = createSeededRandom(`${dateString}:${userId ?? 'anon'}`);
	const cafeIds = (cafeIdFilter && cafeIdFilter.size > 0) ? Array.from(cafeIdFilter) : Array.from(CAFES_BY_ID.keys());

	const sectionsByType = new Map<RecommendationSectionType, Array<IRecommendationItem>>();
	await Promise.all(cafeIds.map(async (cafeId) => {
		const context = buildContext({
			userId,
			dateString,
			homepageIds,
			cafeId,
			random
		});

		const [cafeRecommendations, userRecommendations] = await Promise.all([
			getRecommendationsForCafe(context),
			getRecommendationsForUser(context),
		]);

		addToRecommendations(sectionsByType, cafeRecommendations);
		addToRecommendations(sectionsByType, userRecommendations);
	}));

	const proximityWeights = buildProximityWeightMap(homepageIds, cafeIdFilter);

	return assembleSections({
		claimedKeys: new Set<string>(),
		sectionsByType,
		random,
		proximityWeights,
	});
};

setInterval(() => {
	for (const dateString of GLOBAL_RECOMMENDATION_SECTIONS_CACHE.keys()) {
		if (!isDateStringWithinMenuWindow(dateString)) {
			GLOBAL_RECOMMENDATION_SECTIONS_CACHE.delete(dateString);
		}
	}

	for (const dateString of USER_RECOMMENDATION_SECTIONS_CACHE.keys()) {
		if (!isDateStringWithinMenuWindow(dateString)) {
			USER_RECOMMENDATION_SECTIONS_CACHE.delete(dateString);
		}
	}
}, RECOMMENDATIONS_CACHE_CLEANUP_INTERVAL.inMilliseconds);