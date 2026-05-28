import { SearchEntityType } from '@msdining/common/models/search';
import type {
    IDailyMenuService,
    IPublishDailyMenuParams,
} from '../../../../../shared/services/daily-menu.js';
import { DailyMenuStorageClient } from './daily-menu.js';
import { retrieveDailyCafeMenuAsync } from '../../../cache/daily-menu.js';
import { getMenuWatermark } from '../../../cache/menu-watermark.js';

const mapToRecord = <T>(map: ReadonlyMap<string, T>): Record<string, T> =>
    Object.fromEntries(map);

const setMapToRecord = (map: ReadonlyMap<string, Set<string>>): Record<string, string[]> =>
    Object.fromEntries(Array.from(map, ([key, values]) => [key, Array.from(values)]));

export const dailyMenuServiceCommands = {
    publishDailyStationMenuAsync: async (data: IPublishDailyMenuParams) =>
        DailyMenuStorageClient.publishDailyStationMenuAsync(data),
    retrieveDailyMenuAsync: async ({ cafeId, dateString }: { cafeId: string; dateString: string }) =>
        DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, dateString),
    retrieveDailyCafeMenu: async ({ cafeId, dateString }: { cafeId: string; dateString: string }) =>
        retrieveDailyCafeMenuAsync(cafeId, dateString),
    getMenuWatermark: async ({ cafeId, dateString }: { cafeId: string; dateString: string }) =>
        getMenuWatermark(cafeId, dateString),
    retrieveDailyMenuOverviewHeadersAsync: async ({ cafeId, dateString }: { cafeId: string; dateString: string }) =>
        DailyMenuStorageClient.retrieveDailyMenuOverviewHeadersAsync(cafeId, dateString),
    isAnyMenuAvailableForDayAsync: async ({ dateString }: { dateString: string }) =>
        DailyMenuStorageClient.isAnyMenuAvailableForDayAsync(dateString),
    getCafesAvailableForDayAsync: async ({ dateString }: { dateString: string }) =>
        Array.from(await DailyMenuStorageClient.getCafesAvailableForDayAsync(dateString)),
    isAnyAllowedMenuAvailableForCafe: async ({ cafeId }: { cafeId: string }) =>
        DailyMenuStorageClient.isAnyAllowedMenuAvailableForCafe(cafeId),
    getPendingMenusForEmbedding: async (_data: {}) =>
        DailyMenuStorageClient.getPendingMenusForEmbedding(),
    getMenusForSearch: async ({ date }: { date: Date | null }) =>
        DailyMenuStorageClient.getMenusForSearch(date),
    retrieveCafeChildAvailability: async ({ cafeId, startDate, endDate }: { cafeId: string; startDate: Date; endDate: Date }) => {
        const result = await DailyMenuStorageClient.retrieveCafeChildAvailability(cafeId, startDate, endDate);
        return {
            stationVisitsById: setMapToRecord(result.stationVisitsById),
            itemVisitsById:    setMapToRecord(result.itemVisitsById),
        };
    },
    retrieveStationItemAvailability: async ({ stationId, startDate, endDate }: { stationId: string; startDate: Date; endDate: Date }) =>
        setMapToRecord(await DailyMenuStorageClient.retrieveStationItemAvailability(stationId, startDate, endDate)),
    retrieveEntityVisits: async ({ entityType, entityName }: { entityType: SearchEntityType; entityName: string }) =>
        DailyMenuStorageClient.retrieveEntityVisits(entityType, entityName),
    retrieveFirstStationVisitsForCafe: async ({ cafeId }: { cafeId: string }) =>
        Object.fromEntries(
            Array.from(
                await DailyMenuStorageClient.retrieveFirstStationVisitsForCafe(cafeId),
                ([stationId, firstVisit]) => [stationId, firstVisit.toISOString()],
            ),
        ),
    retrieveFirstStationVisitDate: async ({ stationId }: { stationId: string }) => {
        const date = await DailyMenuStorageClient.retrieveFirstStationVisitDate(stationId);
        return date?.toISOString() ?? null;
    },
    retrieveFirstMenuItemVisitDate: async ({ menuItemId }: { menuItemId: string }) =>
        DailyMenuStorageClient.retrieveFirstMenuItemVisitDate(menuItemId),
    retrieveAllFirstMenuItemAppearances: async (_data: {}) =>
        mapToRecord(await DailyMenuStorageClient.retrieveAllFirstMenuItemAppearances()),
    getCafeHoursForDate: async ({ cafeId, dateString }: { cafeId: string; dateString: string }) =>
        DailyMenuStorageClient.getCafeHoursForDate(cafeId, dateString),
    getStationHoursForDate: async ({ stationId, dateString }: { stationId: string; dateString: string }) =>
        DailyMenuStorageClient.getStationHoursForDate(stationId, dateString),
    getAllCafeHoursForDate: async ({ dateString }: { dateString: string }) =>
        mapToRecord(await DailyMenuStorageClient.getAllCafeHoursForDate(dateString)),
    upsertDailyCafeAsync: async ({ cafeId, dateString, data }: { cafeId: string; dateString: string; data: { isAvailable: boolean; shutdownMessageHash?: string | null } }) =>
        DailyMenuStorageClient.upsertDailyCafeAsync(cafeId, dateString, data),
    getShutDownCafesAsync: async ({ dateString }: { dateString: string }) =>
        mapToRecord(await DailyMenuStorageClient.getShutDownCafesAsync(dateString)),
    retrieveDailyCafeStateAsync: async ({ cafeId, dateString }: { cafeId: string; dateString: string }) =>
        DailyMenuStorageClient.retrieveDailyCafeStateAsync(cafeId, dateString),
} satisfies IDailyMenuService;
