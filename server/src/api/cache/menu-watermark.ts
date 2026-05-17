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
 * Server restart resets the map. Clients then get one full payload (no
 * If-None-Match → 200 with the fresh ETag) and revalidations resume.
 * No persistence is needed.
 */

import { CACHE_EVENTS } from '../storage/events.js';
import { hasAnythingChangedInPublishedMenu } from '../../models/storage-events.js';

const watermarks = new Map<string, number>();

const getKey = (cafeId: string, dateString: string): string =>
    `${cafeId}@${dateString}`;

export const getMenuWatermark = (cafeId: string, dateString: string): number | undefined =>
    watermarks.get(getKey(cafeId, dateString));

CACHE_EVENTS.on('menuPublished', (event) => {
    if (!hasAnythingChangedInPublishedMenu(event)) {
        return;
    }
    watermarks.set(getKey(event.cafe.id, event.dateString), Date.now());
});
