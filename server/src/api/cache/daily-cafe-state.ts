import Duration from '@arcticzeroo/duration';
import { CafeShutdownType, ICafeShutdownState } from '@msdining/common/models/cafe';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { STORAGE_EVENTS } from '../storage/events.js';
import { ExpiringCacheMap } from './expiring-cache.js';

const SHUT_DOWN_CACHE_TIME = new Duration({ minutes: 5 });

const SHUT_DOWN_CAFE_STATE_CACHE = new ExpiringCacheMap<string /*dateString*/, Map<string /*cafeId*/, ICafeShutdownState>>(
	SHUT_DOWN_CACHE_TIME,
	(dateString) => DailyMenuStorageClient.getShutDownCafesAsync(dateString)
);

STORAGE_EVENTS.on('menuPublished', (event) => {
	SHUT_DOWN_CAFE_STATE_CACHE.delete(event.dateString);
});

export const getShutdownCafeStateAsync = (dateString: string): Promise<Map<string, ICafeShutdownState>> => {
	return SHUT_DOWN_CAFE_STATE_CACHE.get(dateString);
};

export const getShutDownCafeIdsAsync = async (dateString: string): Promise<Set<string>> => {
	const state = await getShutdownCafeStateAsync(dateString);
	return new Set(state.keys());
};
