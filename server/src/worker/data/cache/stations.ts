/**
 * In-memory cache of all stations, keyed by station ID.
 *
 * Lazy-populated on first access (single query for all stations).
 * Incrementally updated on menu publish — new/renamed stations are
 * upserted from the event's menu data.
 */

import { StationStorageClient, toStationRecord } from '../storage/clients/station/station.js';
import { lazyAsync } from '../../../shared/util/lazy.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { getEntityKeyFromParts } from '@msdining/common/util/entity-key';
import type { IStationRecord } from '../../../shared/services/station.js';
import { STORAGE_EVENTS } from '../../../shared/util/events.js';

const STATION_CACHE = lazyAsync(async () => {
    const stations = await StationStorageClient.retrieveAllStationsAsync();
    return new Map(stations.map(station => [station.id, toStationRecord(station)]));
});

export const retrieveStation = async (stationId: string): Promise<IStationRecord | null> => {
    const cache = await STATION_CACHE.value;
    return cache.get(stationId) ?? null;
};

export const getStationNamesByIds = async (stationIds: string[]): Promise<Map<string, string>> => {
    if (stationIds.length === 0) {
        return new Map();
    }

    const cache = await STATION_CACHE.value;
    const result = new Map<string, string>();
    for (const id of stationIds) {
        const station = cache.get(id);
        if (station != null) {
            result.set(id, station.name);
        }
    }
    return result;
};

STORAGE_EVENTS.on('menuPublished', async (event) => {
    if (!STATION_CACHE.isInitialized) {
        return;
    }

    const cache = await STATION_CACHE.value;
    for (const station of event.menu) {
        const normalizedName = normalizeNameForSearch(station.name);
        const groupId = station.groupId ?? null;
        cache.set(station.id, toStationRecord({
            id:             station.id,
            name:           station.name,
            normalizedName,
            logoUrl:        station.logoUrl ?? null,
            menuId:         station.menuId,
            groupId,
            entityKey:      getEntityKeyFromParts(groupId, normalizedName),
            cafeId:         station.cafeId,
            opensAt:        station.opensAt,
            closesAt:       station.closesAt,
            externalMenuLastUpdateTime: station.menuLastUpdateTime ?? new Date(0),
        }));
    }
});
