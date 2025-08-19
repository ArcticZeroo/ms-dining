import { LockedMap } from '../../util/map.js';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { CACHE_EVENTS } from '../storage/events.js';
import { logError } from '../../util/log.js';
import { throwError } from '../../util/error.js';

const FIRST_STATION_APPEARANCE_CACHE = new LockedMap<string /*stationId*/, Date>();

export const retrieveFirstStationAppearance = async (stationId: string): Promise<Date | null> => {
	return FIRST_STATION_APPEARANCE_CACHE.update(stationId, async (visit) => {
		return visit
			?? await DailyMenuStorageClient.retrieveFirstStationVisitDate(stationId)
			?? throwError('No first visit date found for station');
	});
}

CACHE_EVENTS.on('menuPublished', event => {
	if (event.removedStations.size === 0 && event.addedStations.size === 0) {
		return;
	}

	Promise.all(Array.from(event.dirtyStations).map(stationId => FIRST_STATION_APPEARANCE_CACHE.delete(stationId)))
		.catch(err => logError(`Failed to clear first station visit cache. Error: ${err}`));
});