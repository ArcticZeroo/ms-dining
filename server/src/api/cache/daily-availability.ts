import { ExpiringCacheMap } from './expiring-cache.js';
import Duration from '@arcticzeroo/duration';
import { CAFES_BY_ID } from '../../constants/cafes.js';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { STORAGE_EVENTS } from '../storage/events.js';
import { logError } from '../../util/log.js';

const AVAILABILITY_CACHE_TIME = new Duration({ minutes: 5 });

const AVAILABILITY_CACHE_BY_CAFE = new Map<string /*cafeId*/, ExpiringCacheMap<string /*dateString*/, boolean>>();

for (const cafe of CAFES_BY_ID.values()) {
    AVAILABILITY_CACHE_BY_CAFE.set(
        cafe.id,
        new ExpiringCacheMap<string, boolean>(
            AVAILABILITY_CACHE_TIME.inMilliseconds,
            (dateString) => DailyMenuStorageClient.retrieveIsAvailableAsync(cafe.id, dateString)
        )
    );
}

STORAGE_EVENTS.on('menuPublished', (event) => {
    const cache = AVAILABILITY_CACHE_BY_CAFE.get(event.cafe.id);
    if (!cache) {
        return;
    }

    cache.set(event.dateString, event.isAvailable)
        .catch(err => logError(`Failed to update availability cache for cafe "${event.cafe.id}": ${err}`));
});

export const retrieveIsAvailableAsync = async (cafeId: string, dateString: string): Promise<boolean> => {
    const cache = AVAILABILITY_CACHE_BY_CAFE.get(cafeId);
    if (!cache) {
        return true;
    }
    return cache.get(dateString);
};
