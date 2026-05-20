import Duration from '@arcticzeroo/duration';
import type { ICafeShutdownState } from '@msdining/common/models/cafe';
import { STORAGE_EVENTS } from '../storage/events.js';
import { ExpiringCacheMap } from './expiring-cache.js';
import { getServices } from '../../main/services/registry.js';

const SHUT_DOWN_CACHE_TIME = new Duration({ minutes: 5 });

const SHUT_DOWN_CAFE_STATE_CACHE = new ExpiringCacheMap<string /*dateString*/, Record<string /*cafeId*/, ICafeShutdownState>>(
	SHUT_DOWN_CACHE_TIME,
	(dateString) => getServices().data.dailyMenu.getShutDownCafesAsync({ dateString })
);

STORAGE_EVENTS.on('menuPublished', (event) => {
	SHUT_DOWN_CAFE_STATE_CACHE.delete(event.dateString);
});

export const getShutdownCafeStateAsync = (dateString: string): Promise<Record<string, ICafeShutdownState>> => {
	return SHUT_DOWN_CAFE_STATE_CACHE.get(dateString);
};

export const getShutDownCafeIdsAsync = async (dateString: string): Promise<Set<string>> => {
	const state = await getShutdownCafeStateAsync(dateString);
	return new Set(Object.keys(state));
};
