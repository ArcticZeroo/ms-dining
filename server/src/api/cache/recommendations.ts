import Duration from '@arcticzeroo/duration';
import { IRecommendationItem, IRecommendationSection, IRecommendationsResponse } from '@msdining/common/models/recommendation';
import { LockedMap } from '../../util/map.js';
import { computeRecommendations } from '../recommendations/compute.js';
import { getNewItemsForCafe } from '../recommendations/signals/user-specific/new-at-favorites.js';
import { getPopularItems } from '../recommendations/signals/anonymous/popular.js';
import { getHiddenGems } from '../recommendations/signals/anonymous/hidden-gems.js';
import { IRecommendationContext, getAllAvailableItems, ITEMS_PER_SECTION, withErrorHandling } from '../recommendations/shared.js';
import { lazy } from '../../util/lazy.js';
import { isDateStringWithinMenuWindow } from '../../util/date.js';
import { setInterval } from 'node:timers';
import { logError } from '../../util/log.js';
import { throwError } from '../../util/error.js';

const USER_CACHE_TTL = new Duration({ minutes: 30 });
const ANONYMOUS_POOL_MULTIPLIER = 3;
const RECOMMENDATION_CLEANUP_INTERVAL = new Duration({ minutes: 10 });

interface ICacheEntry<T> {
	value: T;
	dateString: string;
	expiresAt: number;
}

// --- Per-cafe new-at-favorites cache ---
const NEW_AT_FAVORITES_CACHE = new LockedMap<string, ICacheEntry<IRecommendationItem[]>>();

export const getNewAtFavoritesForCafeAsync = async (cafeId: string, dateString: string): Promise<IRecommendationItem[]> => {
	const cacheKey = `${cafeId}:${dateString}`;
	return NEW_AT_FAVORITES_CACHE.update(cacheKey, async (existing) => {
		if (existing && existing.expiresAt > Date.now()) {
			return existing;
		}
		const items = await getNewItemsForCafe(cafeId, dateString);
		return {
			dateString,
			value:     items,
			expiresAt: Date.now() + USER_CACHE_TTL.inMilliseconds,
		};
	}).then(entry => entry.value);
};

// --- Global anonymous sections cache (popular + hidden-gems) ---
const ANONYMOUS_SECTIONS_CACHE = new LockedMap<string, ICacheEntry<IRecommendationSection[]>>();

export const getAnonymousSectionsAsync = async (dateString: string, cafeIdFilter?: string): Promise<IRecommendationSection[]> => {
	const cacheKey = cafeIdFilter ? `${dateString}:${cafeIdFilter}` : dateString;
	return ANONYMOUS_SECTIONS_CACHE.update(cacheKey, async (existing) => {
		if (existing && existing.expiresAt > Date.now()) {
			return existing;
		}

		const poolCount = ITEMS_PER_SECTION * ANONYMOUS_POOL_MULTIPLIER;
		const context: IRecommendationContext = {
			dateString,
			cafeIdFilter,
			userId:             null,
			homepageIds:        [],
			getAllMenuItems:    lazy(() => getAllAvailableItems(dateString, cafeIdFilter)),
			random:             () => throwError('Random function should not be called for anonymous recommendations'),
			getUserReviews:     () => Promise.resolve([]),
			getNewItemsForCafe: (cafeId) => getNewAtFavoritesForCafeAsync(cafeId, dateString),
		};

		const results = await Promise.all([
			withErrorHandling('popular', getPopularItems(context, poolCount)),
			withErrorHandling('hiddenGems', getHiddenGems(context, poolCount)),
		]);

		const sections = results.filter((section): section is IRecommendationSection => section != null);

		return {
			value:     sections,
			dateString,
			expiresAt: Date.now() + USER_CACHE_TTL.inMilliseconds,
		};
	}).then(entry => entry.value);
};

// --- Per-user recommendation cache ---
interface IRecommendationCacheKey {
	userId: string | null;
	dateString: string;
	homepageIds: string[];
	cafeId?: string;
}

const cacheKeyToString = (key: IRecommendationCacheKey) =>
	`${key.userId ?? 'anon'}:${key.dateString}:${key.homepageIds.join(',')}:${key.cafeId ?? 'all'}`;

const RECOMMENDATION_CACHE = new LockedMap<string, ICacheEntry<IRecommendationsResponse>>();

export const getRecommendationsAsync = async (
	userId: string | null,
	dateString: string,
	homepageIds: string[],
	cafeId?: string,
): Promise<IRecommendationsResponse> => {
	const cacheKey = cacheKeyToString({
		userId,
		dateString,
		homepageIds,
		cafeId,
	});

	return RECOMMENDATION_CACHE.update(cacheKey, async (existing) => {
		if (existing && existing.expiresAt > Date.now()) {
			return existing;
		}

		const result = await computeRecommendations(userId, dateString, homepageIds, cafeId);
		return {
			value:     result,
			dateString,
			expiresAt: Date.now() + USER_CACHE_TTL.inMilliseconds,
		};
	}).then(entry => entry.value);
};

const isEntryOutsideMenuWindow = (_key: string, entry: ICacheEntry<unknown>) =>
	!isDateStringWithinMenuWindow(entry.dateString);

const cleanOldRecommendationCaches = async () => {
	await Promise.all([
		NEW_AT_FAVORITES_CACHE.deleteWhere(isEntryOutsideMenuWindow),
		ANONYMOUS_SECTIONS_CACHE.deleteWhere(isEntryOutsideMenuWindow),
		RECOMMENDATION_CACHE.deleteWhere(isEntryOutsideMenuWindow),
	]);
};

setInterval(() => {
	cleanOldRecommendationCaches()
		.catch(error => logError('Failed to clean old recommendation caches:', error));
}, RECOMMENDATION_CLEANUP_INTERVAL.inMilliseconds);
