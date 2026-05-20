import type { ICafeStation } from '../models/cafe.js';

/** Wire-safe representation of a persisted station record (mirrors Prisma's `Station` model). */
export interface IStationRecord {
    id: string;
    name: string;
    normalizedName: string;
    logoUrl: string | null;
    menuId: string;
    groupId: string | null;
    cafeId: string;
}

export interface IStationService {
    /** Create or upsert a station. */
    createStation(data: { station: ICafeStation; allowUpdateIfExisting?: boolean }): Promise<void>;

    /** Get a single station by id. Returns null if not found. */
    retrieveStation(data: { stationId: string }): Promise<IStationRecord | null>;

    /** Get all stations that have no group assignment. */
    retrieveAllStationsWithoutGroup(data: {}): Promise<IStationRecord[]>;

    /** Get the names of all stations. */
    retrieveAllStationNames(data: {}): Promise<string[]>;
}
