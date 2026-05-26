import type { Station } from '@prisma/client';
import { ICafeStation } from '../../../../../shared/models/cafe.js';
import type { IStationRecord, IStationService } from '../../../../../shared/services/station.js';
import { StationStorageClient } from './station.js';

const toStationRecord = (s: Station): IStationRecord => ({
    id:             s.id,
    name:           s.name,
    normalizedName: s.normalizedName,
    logoUrl:        s.logoUrl,
    menuId:         s.menuId,
    groupId:        s.groupId,
    cafeId:         s.cafeId,
});

export const stationServiceCommands = {
    createStation: async ({ station, allowUpdateIfExisting }: { station: ICafeStation; allowUpdateIfExisting?: boolean }) =>
        StationStorageClient.createStationAsync(station, allowUpdateIfExisting),
    retrieveStation: async ({ stationId }: { stationId: string }) => {
        const s = await StationStorageClient.retrieveStationAsync(stationId);
        return s ? toStationRecord(s) : null;
    },
    retrieveAllStationsWithoutGroup: async (_data: {}) => {
        const stations = await StationStorageClient.retrieveAllStationsWithoutGroup();
        return stations.map(toStationRecord);
    },
    retrieveAllStationNames: async (_data: {}) =>
        StationStorageClient.retrieveAllStationNamesAsync(),
} satisfies IStationService;
