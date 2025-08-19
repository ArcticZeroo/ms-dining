import { LockedMap } from '../../util/map.js';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { STORAGE_EVENTS } from '../storage/events.js';
import { logError } from '../../util/log.js';
import { throwError } from '../../util/error.js';

const FIRST_MENU_ITEM_APPEARANCE = new LockedMap(await DailyMenuStorageClient.retrieveAllFirstMenuItemAppearances());

export const retrieveFirstMenuItemAppearance = (menuItemId: string) => {
	return FIRST_MENU_ITEM_APPEARANCE.update(menuItemId, async (visitDate) => {
		return visitDate ?? await DailyMenuStorageClient.retrieveFirstMenuItemVisitDate(menuItemId) ?? throwError(`No first visit date found for menu item ${menuItemId}`);
	});
}

STORAGE_EVENTS.on('menuPublished', ({ removedMenuItemsByStation }) => {
	const removePromises: Array<Promise<void>> = [];
	for (const menuItemIds of removedMenuItemsByStation.values()) {
		for (const menuItemId of menuItemIds) {
			removePromises.push(FIRST_MENU_ITEM_APPEARANCE.delete(menuItemId));
		}
	}
	Promise.all(removePromises).catch(err => logError('Error removing first menu item visit dates', err));
});