import { ICafeStation } from '../../models/cafe.js';
import { ExpiringCacheMap } from './expiring-cache.js';
import Duration from '@arcticzeroo/duration';
import { CAFES_BY_ID } from '../../constants/cafes.js';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { CACHE_EVENTS, STORAGE_EVENTS } from '../storage/events.js';
import { logError } from '../../util/log.js';

const MENU_CACHE_TIME = new Duration({ minutes: 5 });

const MENU_CACHE_BY_CAFE = new Map<string /*cafeId*/, ExpiringCacheMap<string /*dateString*/, Array<ICafeStation>>>();

for (const cafe of CAFES_BY_ID.values()) {
	const cache = new ExpiringCacheMap<string, Array<ICafeStation>>(
		MENU_CACHE_TIME.inMilliseconds,
		(dateString) => DailyMenuStorageClient.retrieveDailyMenuAsync(cafe.id, dateString)
	);

	MENU_CACHE_BY_CAFE.set(
		cafe.id,
		cache
	);
}

STORAGE_EVENTS.on('menuPublished', (event) => {
	const { cafe, dateString, menu } = event;

	const cache = MENU_CACHE_BY_CAFE.get(cafe.id);
	if (!cache) {
		logError(`No cache found for cafe with ID "${cafe.id}" when publishing menu`);
		return;
	}

	cache.set(dateString, menu)
		.then(() => {
			CACHE_EVENTS.emit('menuPublished', event);
		})
		.catch(err => {
			logError(`Failed to update menu cache for cafe "${cafe.id}" on date "${dateString}": ${err}`);
		});
});

// todo: update review headers for all menu items currently in cache
// this might be expensive, maybe we can live with stuff being stale for a bit
// CACHE_EVENTS.on('reviewDirty', (event) => {
//
// });

export const retrieveDailyCafeMenuAsync = async (cafeId: string, dateString: string): Promise<Array<ICafeStation>> => {
	const cache = MENU_CACHE_BY_CAFE.get(cafeId);

	if (!cache) {
		return [];
	}

	return cache.get(dateString);
}