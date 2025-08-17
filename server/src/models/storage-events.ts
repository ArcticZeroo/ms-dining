import { ICafe, ICafeStation } from './cafe.js';

export interface IMenuPublishEvent {
	cafe: ICafe;
	dateString: string;
	menu: ICafeStation[];
	addedStations: Set<string /*stationId*/>;
	removedStations: Set<string /*stationId*/>;
	updatedStations: Set<string /*stationId*/>;
	dirtyStations: Set<string /*stationId*/>;
	removedMenuItemsByStation: Map<string /*stationId*/, Set<string /*menuItemId*/>>;
	addedMenuItemsByStation: Map<string /*stationId*/, Set<string /*menuItemId*/>>;
	dirtyMenuItemIds: Set<string /*menuItemId*/>;
}

export const hasAnythingChangedInPublishedMenu = (event: IMenuPublishEvent): boolean => {
	return (
		event.dirtyStations.size === 0 &&
		event.dirtyMenuItemIds.size === 0
	);
}