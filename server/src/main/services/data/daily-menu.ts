import type { IDailyMenuService } from '../../../shared/services/daily-menu.js';
import { dataHandler } from './handler.js';

export const dailyMenuService: IDailyMenuService = {
    publishDailyStationMenuAsync: (data) =>
        dataHandler.sendRequest('dailyMenu', 'publishDailyStationMenuAsync', data),
    retrieveDailyMenuAsync: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveDailyMenuAsync', data),
    retrieveDailyCafeMenu: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveDailyCafeMenu', data),
    getMenuWatermark: (data) =>
        dataHandler.sendRequest('dailyMenu', 'getMenuWatermark', data),
    retrieveDailyMenuOverviewHeadersAsync: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveDailyMenuOverviewHeadersAsync', data),
    isAnyMenuAvailableForDayAsync: (data) =>
        dataHandler.sendRequest('dailyMenu', 'isAnyMenuAvailableForDayAsync', data),
    getCafesAvailableForDayAsync: (data) =>
        dataHandler.sendRequest('dailyMenu', 'getCafesAvailableForDayAsync', data),
    isAnyAllowedMenuAvailableForCafe: (data) =>
        dataHandler.sendRequest('dailyMenu', 'isAnyAllowedMenuAvailableForCafe', data),
    getPendingMenusForEmbedding: (data) =>
        dataHandler.sendRequest('dailyMenu', 'getPendingMenusForEmbedding', data),
    getMenusForSearch: (data) =>
        dataHandler.sendRequest('dailyMenu', 'getMenusForSearch', data),
    retrieveCafeChildAvailability: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveCafeChildAvailability', data),
    retrieveStationItemAvailability: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveStationItemAvailability', data),
    retrieveEntityVisits: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveEntityVisits', data),
    retrieveFirstStationVisitsForCafe: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveFirstStationVisitsForCafe', data),
    retrieveFirstStationVisitDate: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveFirstStationVisitDate', data),
    retrieveFirstMenuItemVisitDate: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveFirstMenuItemVisitDate', data),
    retrieveAllFirstMenuItemAppearances: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveAllFirstMenuItemAppearances', data),
    upsertDailyCafeAsync: (data) =>
        dataHandler.sendRequest('dailyMenu', 'upsertDailyCafeAsync', data),
    getShutDownCafesAsync: (data) =>
        dataHandler.sendRequest('dailyMenu', 'getShutDownCafesAsync', data),
    retrieveDailyCafeStateAsync: (data) =>
        dataHandler.sendRequest('dailyMenu', 'retrieveDailyCafeStateAsync', data),
};
