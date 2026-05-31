import { ICafeStation } from '../../../../../shared/models/cafe.js';
import type { IStationService } from '../../../../../shared/services/station.js';
import { StationStorageClient, toStationRecord } from './station.js';
import { retrieveStation } from '../../../cache/stations.js';

export const stationServiceCommands = {
    createStation: async ({ station, allowUpdateIfExisting }: { station: ICafeStation; allowUpdateIfExisting?: boolean }) =>
        StationStorageClient.createStationAsync(station, allowUpdateIfExisting),
    retrieveStation: async ({ stationId }: { stationId: string }) =>
        retrieveStation(stationId),
    retrieveAllStationsWithoutGroup: async () => {
        const stations = await StationStorageClient.retrieveAllStationsWithoutGroup();
        return stations.map(toStationRecord);
    },
    retrieveAllStationNames: async () =>
        StationStorageClient.retrieveAllStationNamesAsync(),
    getStationHours: async ({ stationId }: { stationId: string }) =>
        StationStorageClient.getStationHoursAsync(stationId),
    getCafeHoursForDate: async ({ cafeId, dateString }: { cafeId: string; dateString: string }) =>
        StationStorageClient.getCafeHoursAsync(cafeId, dateString),
    getAllCafeHoursForDate: async ({ dateString }: { dateString: string }) => {
        const map = await StationStorageClient.getAllCafeHoursAsync(dateString);
        return Object.fromEntries(map);
    },
} satisfies IStationService;
