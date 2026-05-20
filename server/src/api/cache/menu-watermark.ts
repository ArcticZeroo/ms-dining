/**
 * In-memory watermark of "when did this cafe-day's menu last actually
 * change?" — keyed by `${cafeId}@${dateString}`, value is a Date.now()
 * millisecond timestamp.
 *
 * Used as the source for HTTP ETags on menu routes (see middleware/menu-etag.ts).
 * Updates only fire from real menuPublished events that include a non-empty
 * dirty set, so a cron re-sync that produced identical data does NOT bump
 * the watermark and clients keep getting 304s.
 *
 * Cafe-days that haven't seen a menuPublished event in this server's
 * lifetime — typically every cafe-day right after a restart, since boot
 * skips re-sync when the DB already has today's menus — fall back to the
 * server-start timestamp. That gives every menu response a stable ETag
 * for the duration of one server lifetime; a restart bumps every fallback
 * ETag once and clients re-download once.
 */

import { CACHE_EVENTS } from '../storage/events.js';
import { hasAnythingChangedInPublishedMenu } from '../../shared/models/storage-events.js';

const SERVER_START_MS = Date.now();

const watermarks = new Map<string, number>();

const getKey = (cafeId: string, dateString: string): string =>
    `${cafeId}@${dateString}`;

export const getMenuWatermark = (cafeId: string, dateString: string): number =>
    watermarks.get(getKey(cafeId, dateString)) ?? SERVER_START_MS;

CACHE_EVENTS.on('menuPublished', (event) => {
    if (!hasAnythingChangedInPublishedMenu(event)) {
        return;
    }
    watermarks.set(getKey(event.cafe.id, event.dateString), Date.now());
});
