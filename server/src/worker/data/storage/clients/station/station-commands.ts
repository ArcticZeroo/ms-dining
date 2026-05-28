import { ICafeStation } from '../../../../../shared/models/cafe.js';
import type { IStationService } from '../../../../../shared/services/station.js';
import { StationStorageClient, toStationRecord } from './station.js';
import { retrieveStation } from '../../../cache/stations.js';

export const stationServiceCommands = {
    createStation: async ({ station, allowUpdateIfExisting }: { station: ICafeStation; allowUpdateIfExisting?: boolean }) =>
        StationStorageClient.createStationAsync(station, allowUpdateIfExisting),
    retrieveStation: async ({ stationId }: { stationId: string }) =>
        retrieveStation(stationId),
    retrieveAllStationsWithoutGroup: async (_data: {}) => {
        const stations = await StationStorageClient.retrieveAllStationsWithoutGroup();
        return stations.map(toStationRecord);
    },
    retrieveAllStationNames: async (_data: {}) =>
        StationStorageClient.retrieveAllStationNamesAsync(),
} satisfies IStationService;
