import { LockedMap } from '../../../shared/lock/map.js';
import { logError } from '../../../shared/util/log.js';
import { throwError } from '../../../shared/util/error.js';
import { lazyAsync } from '../../../shared/util/lazy.js';
import { getServices } from '../../../shared/services/registry.js';
import { STORAGE_EVENTS } from '../../../shared/util/events.js';

const FIRST_APPEARANCE_MAP = lazyAsync(async () => {
    return new LockedMap(Object.entries(await getServices().data.dailyMenu.retrieveAllFirstMenuItemAppearances({})));
});

export const retrieveFirstMenuItemAppearance = async (menuItemId: string): Promise<string> => {
    const map = await FIRST_APPEARANCE_MAP.value;
    return map.update(menuItemId, async (visitDate) => {
        return visitDate ?? await getServices().data.dailyMenu.retrieveFirstMenuItemVisitDate({ menuItemId }) ?? throwError(`No first visit date found for menu item ${menuItemId}`);
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
