import Duration from '@arcticzeroo/duration';
import {
	IRecommendationItem,
	IRecommendationSection,
	IRecommendationsResponse,
} from '@msdining/common/models/recommendation';
import { setInterval } from 'node:timers';
import { isDateStringWithinMenuWindow } from '../../util/date.js';
import { logError } from '../../util/log.js';
import { LockedMap } from '../../util/map.js';
import { computeAnonymousSections, computeRecommendations } from '../recommendations/compute.js';
import { getNewItemsForCafe } from '../recommendations/signals/user-specific/new-at-favorites.js';

const CACHE_TTL = new Duration({ minutes: 30 });
const CLEANUP_INTERVAL = new Duration({ minutes: 10 });

interface ICacheEntry<T> {
	value: T;
	dateString: string;
	expiresAt: number;
}

// --- Per-cafe new-at-favorites cache ---

const NEW_AT_FAVORITES_CACHE = new LockedMap<string, ICacheEntry<IRecommendationItem[]>>();

const getNewAtFavoritesForCafeAsync = async (cafeId: string, dateString: string): Promise<IRecommendationItem[]> => {
    const cacheKey = `${cafeId}:${dateString}`;
    return NEW_AT_FAVORITES_CACHE.update(cacheKey, async (existing) => {
        if (existing && existing.expiresAt > Date.now()) {
            return existing;
        }
        const items = await getNewItemsForCafe(cafeId, dateString);
        return {
            dateString,
            value:     items,
            expiresAt: Date.now() + CACHE_TTL.inMilliseconds,
        };
    }).then(entry => entry.value);
};

// --- Anonymous sections cache (popular + hidden-gems) ---

const ANONYMOUS_SECTIONS_CACHE = new LockedMap<string, ICacheEntry<IRecommendationSection[]>>();

const getAnonymousSectionsAsync = async (dateString: string, cafeIdFilter?: string): Promise<IRecommendationSection[]> => {
    const cacheKey = cafeIdFilter ? `${dateString}:${cafeIdFilter}` : dateString;
    return ANONYMOUS_SECTIONS_CACHE.update(cacheKey, async (existing) => {
        if (existing && existing.expiresAt > Date.now()) {
            return existing;
        }

        const sections = await computeAnonymousSections(dateString, cafeIdFilter);

        return {
            value:     sections,
            dateString,
            expiresAt: Date.now() + CACHE_TTL.inMilliseconds,
        };
    }).then(entry => entry.value);
};

// --- Per-user recommendation cache ---

const RECOMMENDATION_CACHE = new LockedMap<string, ICacheEntry<IRecommendationsResponse>>();

const buildCacheKey = (userId: string | null, dateString: string, homepageIds: string[], cafeId?: string) =>
    `${userId ?? 'anon'}:${dateString}:${homepageIds.join(',')}:${cafeId ?? 'all'}`;

export const getRecommendationsAsync = async (
    userId: string | null,
    dateString: string,
    homepageIds: string[],
    favoriteItemNames: string[],
    cafeId?: string,
): Promise<IRecommendationsResponse> => {
    const anonymousSections = await getAnonymousSectionsAsync(dateString, cafeId);

    const compute = () => computeRecommendations({
        anonymousSections,
        userId,
        dateString,
        homepageIds,
        cafeIdFilter:   cafeId,
        favoriteItemNames,
        getNewItemsForCafe: (cafeId) => getNewAtFavoritesForCafeAsync(cafeId, dateString),
    });

    // When favorites are provided for an anonymous user, skip the per-user cache —
    // every unique set of favorites would be a different cache key, making it useless.
    // The expensive anonymous pool is already cached; assembly is cheap.
    if (!userId && favoriteItemNames.length > 0) {
        return compute();
    }

    const cacheKey = buildCacheKey(userId, dateString, homepageIds, cafeId);

    return RECOMMENDATION_CACHE.update(cacheKey, async (existing) => {
        if (existing && existing.expiresAt > Date.now()) {
            return existing;
        }

        const result = await compute();

        return {
            value:     result,
            dateString,
            expiresAt: Date.now() + CACHE_TTL.inMilliseconds,
        };
    }).then(entry => entry.value);
};

// --- Cache cleanup ---

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
}, CLEANUP_INTERVAL.inMilliseconds);
