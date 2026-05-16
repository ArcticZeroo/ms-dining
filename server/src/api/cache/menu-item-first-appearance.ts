import { LockedMap } from '../lock/map.js';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { STORAGE_EVENTS } from '../storage/events.js';
import { logError } from '../../util/log.js';
import { throwError } from '../../util/error.js';
import { lazyAsync } from '../../util/lazy.js';

const FIRST_APPEARANCE_MAP = lazyAsync(async () => {
    return new LockedMap(await DailyMenuStorageClient.retrieveAllFirstMenuItemAppearances());
});

export const retrieveFirstMenuItemAppearance = async (menuItemId: string): Promise<string> => {
    const map = await FIRST_APPEARANCE_MAP.value;
    return map.update(menuItemId, async (visitDate) => {
        return visitDate ?? await DailyMenuStorageClient.retrieveFirstMenuItemVisitDate(menuItemId) ?? throwError(`No first visit date found for menu item ${menuItemId}`);
    });
}

STORAGE_EVENTS.on('menuPublished', ({ removedMenuItemsByStation }) => {
// Skip if cache hasn't been initialized yet — first use will pick up the
    // latest state from the DB anyway.
    if (!FIRST_APPEARANCE_MAP.isInitialized) {
        return;
    }
    const removePromises: Array<Promise<void>> = [];
    FIRST_APPEARANCE_MAP.value
        .then(map => {
            for (const menuItemIds of removedMenuItemsByStation.values()) {
                for (const menuItemId of menuItemIds) {
                    removePromises.push(map.delete(menuItemId));
                }
            }
            return Promise.all(removePromises);
        })
        .catch(err => logError('Error removing first menu item visit dates', err));
});
