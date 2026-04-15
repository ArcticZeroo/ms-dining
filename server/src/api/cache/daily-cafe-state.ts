import Duration from '@arcticzeroo/duration';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { STORAGE_EVENTS } from '../storage/events.js';
import { ExpiringCacheMap } from './expiring-cache.js';

const SHUT_DOWN_CACHE_TIME = new Duration({ minutes: 5 });

const SHUT_DOWN_CAFE_IDS_CACHE = new ExpiringCacheMap<string /*dateString*/, Set<string>>(
    SHUT_DOWN_CACHE_TIME,
    (dateString) => DailyMenuStorageClient.getShutDownCafeIdsAsync(dateString)
);

STORAGE_EVENTS.on('menuPublished', (event) => {
    SHUT_DOWN_CAFE_IDS_CACHE.delete(event.dateString);
});

export const getShutDownCafeIdsAsync = (dateString: string): Promise<Set<string>> => {
    return SHUT_DOWN_CAFE_IDS_CACHE.get(dateString);
};
