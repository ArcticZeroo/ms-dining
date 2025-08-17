import { ICafe, ICafeStation } from './cafe.js';

export interface IMenuPublishEvent {
	cafe: ICafe;
	dateString: string;
	menu: ICafeStation[];
	addedStations: Set<string /*stationId*/>;
	removedStations: Set<string /*stationId*/>;
	updatedStations: Set<string /*stationId*/>;
	removedMenuItemsByStation: Map<string /*stationId*/, Set<string /*menuItemId*/>>;
	addedMenuItemsByStation: Map<string /*stationId*/, Set<string /*menuItemId*/>>;
}

export const hasAnythingChangedInPublishedMenu = (event: IMenuPublishEvent): boolean => {
	return (
		event.addedStations.size > 0 ||
		event.removedStations.size > 0 ||
		event.updatedStations.size > 0 ||
		event.removedMenuItemsByStation.size > 0 ||
		event.addedMenuItemsByStation.size > 0
	);
}