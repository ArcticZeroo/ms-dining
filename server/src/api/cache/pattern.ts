import { SearchEntityType } from '@msdining/common/models/search';
import { IEntityVisitData } from '@msdining/common/models/pattern';
import { ExpiringCacheMap } from './expiring-cache.js';
import Duration from '@arcticzeroo/duration';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { calculatePattern, IPatternData } from '@msdining/common/util/pattern-util';
import { CACHE_EVENTS } from '../storage/events.js';
import { hasAnythingChangedInPublishedMenu, IMenuPublishEvent } from '../../models/storage-events.js';
import { StationStorageClient } from '../storage/clients/station.js';
import { MenuItemStorageClient } from '../storage/clients/menu-item.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { logError } from '../../util/log.js';

// todo: consider making a form of LockedMap which has nonexclusive and exclusive reads so that we don't need the invalidation promise
const VISIT_DATA_CACHE = new Map<SearchEntityType, ExpiringCacheMap<string /*name*/, Array<IEntityVisitData>>>();
let invalidationPromise = Promise.resolve();

export const retrieveVisitData = async (entityType: SearchEntityType, name: string): Promise<Array<IEntityVisitData>> => {
	await invalidationPromise;

	if (!VISIT_DATA_CACHE.has(entityType)) {
		VISIT_DATA_CACHE.set(entityType, new ExpiringCacheMap(
			new Duration({ minutes: 5 }),
			async name => DailyMenuStorageClient.retrieveEntityVisits(
				entityType,
				name
			)
		));
	}

	return VISIT_DATA_CACHE.get(entityType)!.get(normalizeNameForSearch(name));
}

export const retrievePatternsByCafeId = async (entityType: SearchEntityType, name: string) => {
	const visits = await retrieveVisitData(entityType, name);
	const visitsByCafeId = new Map<string /*cafeId*/, Array<string> /*dateStrings*/>();

	for (const { cafeId, dateString } of visits) {
		if (!visitsByCafeId.has(cafeId)) {
			visitsByCafeId.set(cafeId, []);
		}

		visitsByCafeId.get(cafeId)!.push(dateString);
	}

	const patternsByCafeId = new Map<string /*cafeId*/, IPatternData>();
	for (const [cafeId, dateStrings] of visitsByCafeId.entries()) {
		const pattern = calculatePattern(dateStrings);
		patternsByCafeId.set(cafeId, pattern);
	}

	return patternsByCafeId;
}

const invalidateEntityCache = async (entityType: SearchEntityType, dirtyNames: Set<string>) => {
	const cache = VISIT_DATA_CACHE.get(entityType);
	if (!cache) {
		return;
	}

	await Promise.all(Array.from(dirtyNames).map(name => cache.delete(name)));
}

const invalidateCacheOnMenuPublished = async (event: IMenuPublishEvent) => {
	try {
		const dirtyStationNames = new Set<string>();
		const dirtyMenuItemNames = new Set<string>();

		const retrieveStationName = async (stationId: string) => {
			const station = await StationStorageClient.retrieveStationAsync(stationId);
			if (station) {
				dirtyStationNames.add(normalizeNameForSearch(station.name));
			}
		}

		const retrieveMenuItemName = async (menuItemId: string) => {
			const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(menuItemId);
			if (menuItem) {
				dirtyMenuItemNames.add(normalizeNameForSearch(menuItem.name));
			}
		}

		const invalidateStationsPromise = Promise.all(Array.from(event.dirtyStations).map(retrieveStationName))
			.then(() => invalidateEntityCache(SearchEntityType.station, dirtyStationNames));

		const invalidateMenuItemsPromise = Promise.all(Array.from(event.dirtyMenuItemIds).map(retrieveMenuItemName))
			.then(() => invalidateEntityCache(SearchEntityType.menuItem, dirtyMenuItemNames));

		await Promise.all([invalidateStationsPromise, invalidateMenuItemsPromise]);
	} catch (err) {
		logError(`Failed to invalidate cache on menu published:`, err);
	}
}

CACHE_EVENTS.on('menuPublished', event => {
	if (!hasAnythingChangedInPublishedMenu(event)) {
		return;
	}

	// Ensure that invalidation is complete before anyone else can use the cache
	invalidationPromise = invalidateCacheOnMenuPublished(event);
});