import { ICafeStation } from '../../models/cafe.js';
import { ExpiringCacheMap } from './expiring-cache.js';
import Duration from '@arcticzeroo/duration';
import { CAFES_BY_ID } from '../../constants/cafes.js';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { setInterval } from 'node:timers';
import { CACHE_EVENTS, STORAGE_EVENTS } from '../storage/events.js';
import { logError } from '../../util/log.js';

const MENU_CACHE_TIME = new Duration({ minutes: 5 });
const MENU_CACHE_CLEANUP_INTERVAL = new Duration({ minutes: 1 });

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

setInterval(() => {
	for (const cache of MENU_CACHE_BY_CAFE.values()) {
		cache.clean()
			.catch(err => logError(`Failed to clean menu cache: ${err}`));
	}
}, MENU_CACHE_CLEANUP_INTERVAL.inMilliseconds);

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

export const retrieveDailyCafeMenuAsync = async (cafeId: string, dateString: string): Promise<Array<ICafeStation>> => {
	const cache = MENU_CACHE_BY_CAFE.get(cafeId);

	if (!cache) {
		throw new Error(`No cache found for cafe with ID "${cafeId}"`);
	}

	return cache.get(dateString);
}