import type { ICafeStation } from '../models/cafe.js';
import { EmptyObject } from '../models/util.js';

export interface IStationRecord {
    id: string;
    name: string;
    normalizedName: string;
    logoUrl: string | null;
    menuId: string;
    groupId: string | null;
    cafeId: string;
    opensAt: number;
    closesAt: number;
}

export interface ICafeHours {
    opensAt: number;
    closesAt: number;
}

export interface IStationService {
    /** Create or upsert a station. */
    createStation(data: { station: ICafeStation; allowUpdateIfExisting?: boolean }): Promise<void>;

    /** Get a single station by id. Returns null if not found. */
    retrieveStation(data: { stationId: string }): Promise<IStationRecord | null>;

    /** Get all stations that have no group assignment. */
    retrieveAllStationsWithoutGroup(data: EmptyObject): Promise<IStationRecord[]>;

    /** Get the names of all stations. */
    retrieveAllStationNames(data: EmptyObject): Promise<string[]>;

    /** Get hours for a single station. */
    getStationHours(data: { stationId: string }): Promise<ICafeHours | null>;

    /** Get aggregate hours for a cafe on a given date (min opensAt, max closesAt across its active stations). */
    getCafeHoursForDate(data: { cafeId: string; dateString: string }): Promise<ICafeHours | null>;

    /** Get aggregate hours for all cafes on a given date, keyed by cafeId. */
    getAllCafeHoursForDate(data: { dateString: string }): Promise<Record<string, ICafeHours>>;
}
