import type { ICafe, ICafeStation } from '../models/cafe.js';
import type { IEntityVisitData } from '@msdining/common/models/pattern';
import { SearchEntityType } from '@msdining/common/models/search';
import type { ICafeShutdownState } from '@msdining/common/models/cafe';

export interface IPublishDailyMenuParams {
    cafe: ICafe;
    dateString: string;
    isAvailable: boolean;
    stations: ICafeStation[];
}

export interface ICafeMenuOverviewHeader {
    name: string;
    logoUrl?: string;
}

export interface ICafeDailyState {
    isAvailable: boolean;
    shutdownState?: ICafeShutdownState;
}

export interface ICafeHours {
    opensAt: number;
    closesAt: number;
}

export interface ICafeChildAvailability {
    stationVisitsById: Record<string, string[]>;
    itemVisitsById: Record<string, string[]>;
}

export interface IPendingEmbeddingMenu {
    cafeId: string;
    dateString: string;
    stationId: string;
    station: {
        name: string;
    };
    categories: Array<{
        name: string;
        menuItems: Array<{
            menuItemId: string;
        }>;
    }>;
}

export interface ISearchableDailyMenu {
    cafeId: string;
    dateString: string;
    stationId: string;
    station: {
        name: string;
        logoUrl: string | null;
        groupId: string | null;
    };
    categories: Array<{
        name: string;
        menuItems: Array<{
            menuItemId: string;
        }>;
    }>;
}

export interface IDailyMenuService {
    publishDailyStationMenuAsync(data: IPublishDailyMenuParams): Promise<void>;
    retrieveDailyMenuAsync(data: { cafeId: string; dateString: string }): Promise<ICafeStation[]>;
    retrieveDailyMenuOverviewHeadersAsync(data: { cafeId: string; dateString: string }): Promise<ICafeMenuOverviewHeader[]>;
    isAnyMenuAvailableForDayAsync(data: { dateString: string }): Promise<boolean>;
    getCafesAvailableForDayAsync(data: { dateString: string }): Promise<string[]>;
    isAnyAllowedMenuAvailableForCafe(data: { cafeId: string }): Promise<boolean>;
    getPendingMenusForEmbedding(data: {}): Promise<IPendingEmbeddingMenu[]>;
    getMenusForSearch(data: { date: Date | null }): Promise<ISearchableDailyMenu[]>;
    retrieveCafeChildAvailability(data: { cafeId: string; startDate: Date; endDate: Date }): Promise<ICafeChildAvailability>;
    retrieveStationItemAvailability(data: { stationId: string; startDate: Date; endDate: Date }): Promise<Record<string, string[]>>;
    retrieveEntityVisits(data: { entityType: SearchEntityType; entityName: string }): Promise<IEntityVisitData[]>;
    retrieveFirstStationVisitsForCafe(data: { cafeId: string }): Promise<Record<string, string>>;
    retrieveFirstStationVisitDate(data: { stationId: string }): Promise<string | null>;
    retrieveFirstMenuItemVisitDate(data: { menuItemId: string }): Promise<string | null>;
    retrieveAllFirstMenuItemAppearances(data: {}): Promise<Record<string, string>>;
    getCafeHoursForDate(data: { cafeId: string; dateString: string }): Promise<ICafeHours | null>;
    getAllCafeHoursForDate(data: { dateString: string }): Promise<Record<string, ICafeHours>>;
    upsertDailyCafeAsync(data: { cafeId: string; dateString: string; data: { isAvailable: boolean; shutdownMessageHash?: string | null } }): Promise<void>;
    getShutDownCafesAsync(data: { dateString: string }): Promise<Record<string, ICafeShutdownState>>;
    retrieveDailyCafeStateAsync(data: { cafeId: string; dateString: string }): Promise<ICafeDailyState>;
}
