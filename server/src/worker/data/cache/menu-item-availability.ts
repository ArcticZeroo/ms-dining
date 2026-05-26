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
import { MenuDateLockedMap } from '../../../shared/lock/menu-date-map.js';

const availabilityByDate = new MenuDateLockedMap<Set<string /*menuItemId*/>>();

export const getAvailableMenuItemIds = (dateString: string): Promise<Set<string>> => availabilityByDate.getOrInsert(dateString, () => DailyMenuStorageClient.getAllMenuItemIdsForDate(dateString));

// Keep the set up to date as menus are published/updated.
CACHE_EVENTS.on('menuPublished', (event) => {
    availabilityByDate.update(event.dateString, (itemIds = new Set<string>()) => {
        for (const removedIds of event.removedMenuItemsByStation.values()) {
            for (const id of removedIds) {
                itemIds.delete(id);
            }
        }

        for (const station of event.menu) {
            for (const id of station.menuItemsById.keys()) {
                itemIds.add(id);
            }
        }

        return itemIds;
    });
});
