import Duration from '@arcticzeroo/duration';
import {
	IRecommendationItem,
	IRecommendationSection,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { setInterval } from 'node:timers';
import { isDateStringWithinMenuWindow } from '../../util/date.js';
import { getNamespaceLogger, logError } from '../../util/log.js';
import { LockedExpiringMap } from '../lock/map.js';
import { getNewAtCafe } from '../recommendations/signals/cafe-specific/new-items.js';
import { CAFES_BY_ID } from '../../constants/cafes.js';
import { getAllAvailableItems, IRecommendationContext, IUserRecommendationContext } from '../recommendations/shared.js';
import { lazy } from '../../util/lazy.js';
import { ReviewStorageClient } from '../storage/clients/review.js';
import { getShutDownCafeIdsAsync } from './daily-cafe-state.js';
import { getPopularItems } from '../recommendations/signals/cafe-specific/popular.js';
import { getHiddenGems } from '../recommendations/signals/cafe-specific/hidden-gems.js';
import { getBasedOnReviews } from '../recommendations/signals/user-specific/based-on-reviews.js';
import { getTrySomethingDifferent } from '../recommendations/signals/user-specific/try-something-different.js';
import { buildProximityWeightMap } from '../../util/proximity.js';
import { assembleSections } from '../recommendations/compute.js';
import { CACHE_EVENTS } from '../storage/events.js';
import { IServerReview } from '../../models/review.js';
import { Semaphore } from '@frozor/lock';

const logger = getNamespaceLogger('recommendations');

const RECOMMENDATIONS_SEMAPHORE = new Semaphore(2);
const GLOBAL_RECOMMENDATION_SECTIONS_CACHE = new Map<string /*dateString*/, LockedExpiringMap<string /*cafeId*/, Map<RecommendationSectionType, Array<IRecommendationItem>>>>();
const USER_RECOMMENDATION_SECTIONS_CACHE = new Map<string /*dateString*/, LockedExpiringMap<string /*userId*/, Map<RecommendationSectionType, Array<IRecommendationItem>>>>();

const RECOMMENDATIONS_CACHE_EXPIRATION = new Duration({ hours: 12 });
const RECOMMENDATIONS_CACHE_CLEANUP_INTERVAL = new Duration({ hours: 12 });

const ensureGlobalCacheForDateString = (dateString: string) => {
	if (!GLOBAL_RECOMMENDATION_SECTIONS_CACHE.has(dateString)) {
		const cache = new LockedExpiringMap<string, Map<RecommendationSectionType, Array<IRecommendationItem>>>(RECOMMENDATIONS_CACHE_EXPIRATION);
		GLOBAL_RECOMMENDATION_SECTIONS_CACHE.set(dateString, cache);
	}

	return GLOBAL_RECOMMENDATION_SECTIONS_CACHE.get(dateString)!;
}

const ensureUserCacheForDateString = (dateString: string, userId: string) => {
	if (!USER_RECOMMENDATION_SECTIONS_CACHE.has(dateString)) {
		const cache = new LockedExpiringMap<string, Map<RecommendationSectionType, Array<IRecommendationItem>>>(RECOMMENDATIONS_CACHE_EXPIRATION);
		USER_RECOMMENDATION_SECTIONS_CACHE.set(dateString, cache);
	}

	return USER_RECOMMENDATION_SECTIONS_CACHE.get(dateString)!;
}

type BuildContextParams = Pick<IRecommendationContext, 'userId' | 'dateString' | 'homepageIds' | 'cafeId'>;

const buildContext = ({
						  userId = null,
						  dateString,
						  homepageIds,
						  cafeId,
					  }: BuildContextParams): IRecommendationContext => {
	return {
		userId,
		dateString,
		homepageIds,
		cafeId,
		getAllMenuItems: lazy(() => getAllAvailableItems(dateString, cafeId))
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
	return cacheForDateString.getOrInsert(context.cafeId, () => RECOMMENDATIONS_SEMAPHORE.acquire(async () => {
		const recommendations = new Map<RecommendationSectionType, Array<IRecommendationItem>>();

		await Promise.all([
			insertIfSucceeded(recommendations, getPopularItems(context)),
			insertIfSucceeded(recommendations, getHiddenGems(context)),
			insertIfSucceeded(recommendations, getNewAtCafe(context)),
		]);

		return recommendations;
	}));
}

const getRecommendationsForUser = async (userId: string | null, dateString: string, seed: string, getUserReviews: () => Promise<Array<IServerReview>>): Promise<Map<RecommendationSectionType, Array<IRecommendationItem>>> => {
	if (!userId) {
		return new Map();
	}

	const context: IUserRecommendationContext = {
		userId,
		dateString,
		seed,
		getAllMenuItems: lazy(() => getAllAvailableItems(dateString)),
	};

	const cacheForDateString = ensureUserCacheForDateString(dateString, userId);
	return cacheForDateString.getOrInsert(context.userId, async () => {
		const recommendations = new Map<RecommendationSectionType, Array<IRecommendationItem>>();

		await Promise.all([
			insertIfSucceeded(recommendations, getBasedOnReviews(context, getUserReviews, seed)),
			insertIfSucceeded(recommendations, getTrySomethingDifferent(context, getUserReviews)),
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

	const seed = `${dateString}:${userId ?? 'anon'}`;
	const allCafeIds = (cafeIdFilter && cafeIdFilter.size > 0) ? Array.from(cafeIdFilter) : Array.from(CAFES_BY_ID.keys());
	const shutDownCafeIds = await getShutDownCafeIdsAsync(dateString);
	const cafeIds = allCafeIds.filter(id => !shutDownCafeIds.has(id));
	const getAllUserReviews = lazy(async () => {
		if (!userId) {
			return [];
		}

		return ReviewStorageClient.getReviewsForUserAsync({ userId });
	});

	const sectionsByType = new Map<RecommendationSectionType, Array<IRecommendationItem>>();

	const recommendations = await Promise.allSettled([
		...cafeIds.map(async (cafeId) => {
			const context = buildContext({
				userId,
				dateString,
				homepageIds,
				cafeId
			});

			const cafeRecommendations = await getRecommendationsForCafe(context);
			if (cafeRecommendations.has(RecommendationSectionType.newAtFavorites) && !context.homepageIds.includes(context.cafeId)) {
				cafeRecommendations.delete(RecommendationSectionType.newAtFavorites);
			}

			return cafeRecommendations;
		}),
		getRecommendationsForUser(userId, dateString, seed, getAllUserReviews)
	]);

	for (const result of recommendations) {
		if (result.status === 'fulfilled') {
			addToRecommendations(sectionsByType, result.value);
		} else {
			logError('Error getting recommendations:', result.reason);
		}
	}

	const proximityWeights = buildProximityWeightMap(homepageIds, cafeIdFilter);

	return assembleSections({
		claimedKeys: new Set<string>(),
		sectionsByType,
		seed,
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

const seedCafeRecommendationsForDate = (dateString: string, cafeId: string) => {
	const context = buildContext({
		userId:      null,
		homepageIds: [],
		dateString,
		cafeId
	});

	getRecommendationsForCafe(context)
		.then(() => logger.info(`Updated recommendations for cafe ${cafeId} on ${dateString}`))
		.catch(err => logError(`Error seeding cafe recommendations for cafe ${cafeId} on ${dateString}:`, err));
}

CACHE_EVENTS.on('menuPublished', (event) => {
	const globalCache = ensureGlobalCacheForDateString(event.dateString);
	globalCache.delete(event.cafe.id)
		.then(() => seedCafeRecommendationsForDate(event.dateString, event.cafe.id));
});