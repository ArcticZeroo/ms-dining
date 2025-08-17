import { LockedMap } from '../../util/map.js';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { CACHE_EVENTS } from '../storage/events.js';
import { logError } from '../../util/log.js';

const FIRST_STATION_VISIT_CACHE = new LockedMap<string /*cafeId*/, Map<string /*stationName*/, Date>>();

export const retrieveFirstStationVisitDate = async (cafeId: string, stationId: string): Promise<Date | null> => {
	const visitMap = await FIRST_STATION_VISIT_CACHE.update(cafeId, async (stationFirstVisits) => {
		if (!stationFirstVisits) {
			stationFirstVisits = new Map<string, Date>();
		}

		if (!stationFirstVisits.has(stationId)) {
			const firstVisitDate = await DailyMenuStorageClient.retrieveFirstStationVisitDate(cafeId, stationId);
			if (firstVisitDate != null) {
				stationFirstVisits.set(stationId, firstVisitDate);
			}
		}

		return stationFirstVisits;
	});

	return visitMap.get(stationId) ?? null;
}

CACHE_EVENTS.on('menuPublished', event => {
	if (event.removedStations.size === 0 && event.addedStations.size === 0) {
		return;
	}

	const dirtyStationIds = new Set<string>([...event.removedStations, ...event.addedStations]);
	FIRST_STATION_VISIT_CACHE.update(event.cafe.id, async (stationFirstVisits) => {
		if (!stationFirstVisits) {
			return new Map();
		}

		for (const stationId of dirtyStationIds) {
			stationFirstVisits.delete(stationId);
		}

		return stationFirstVisits;
	}).catch(err => logError(`Failed to clear first station visit cache for cafe "${event.cafe.id}": ${err}`));
});