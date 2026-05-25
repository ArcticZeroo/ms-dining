/**
 * Per-date set of menu item IDs that are available today.
 *
 * Populated lazily from the DB on first access (single query for all
 * cafes), then kept up to date by CACHE_EVENTS.menuPublished. The cart
 * availability check uses this instead of querying DailyMenuItem per
 * GET /cart request.
 *
 * Uses LockedMap for safe concurrent access, and evicts dates outside
 * the menu window on each menuPublished event.
 */

import { CACHE_EVENTS } from '../storage/events.js';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu/daily-menu.js';
import { LockedMap } from '../../../shared/lock/map.js';
import { isDateStringWithinMenuWindow } from '../../../shared/util/date.js';

const availabilityByDate = new LockedMap<string /*dateString*/, Set<string /*menuItemId*/>>();

/**
 * Returns the set of menu item IDs available on the given date.
 *
 * On first access for a date, runs a single DB query for all distinct
 * menu item IDs on that date. Subsequent calls return the cached set,
 * kept up to date by CACHE_EVENTS.menuPublished.
 */
export const getAvailableMenuItemIds = (dateString: string): Promise<Set<string>> =>
    availabilityByDate.getOrInsert(dateString, async () => {
        const ids = await DailyMenuStorageClient.getAllMenuItemIdsForDate(dateString);
        return new Set(ids);
    });

// Keep the set up to date as menus are published/updated.
CACHE_EVENTS.on('menuPublished', (event) => {
    availabilityByDate.update(event.dateString, (existing) => {
        const set = existing ?? new Set<string>();

        // Remove items from removed stations
        for (const removedIds of event.removedMenuItemsByStation.values()) {
            for (const id of removedIds) {
                set.delete(id);
            }
        }

        // Add all items from the current menu
        for (const station of event.menu) {
            for (const id of station.menuItemsById.keys()) {
                set.add(id);
            }
        }

        return set;
    });

    // Evict stale dates outside the menu window
    availabilityByDate.deleteWhere(
        (dateString) => !isDateStringWithinMenuWindow(dateString),
    );
});
