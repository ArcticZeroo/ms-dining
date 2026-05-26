import { LockedMap } from '../../../shared/lock/map.js';
import { CACHE_EVENTS } from '../storage/events.js';
import { logError } from '../../../shared/util/log.js';
import { throwError } from '../../../shared/util/error.js';
import { getServices } from '../../../shared/services/registry.js';

const FIRST_STATION_APPEARANCE_CACHE = new LockedMap<string /*stationId*/, Date>();

export const retrieveFirstStationAppearance = async (stationId: string): Promise<Date> => {
    return FIRST_STATION_APPEARANCE_CACHE.update(stationId, async (visit) => {
        return visit
			?? (await getServices().data.dailyMenu.retrieveFirstStationVisitDate({ stationId }).then(date => date == null ? null : new Date(date)))
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