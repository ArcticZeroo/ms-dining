import type { IMenuAnalyticsService } from '../../../shared/services/menu-analytics.js';
import { dataHandler } from './handler.js';

export const menuAnalyticsService: IMenuAnalyticsService = {
    retrieveUniquenessDataForCafe: (data) =>
        dataHandler.sendRequest('menuAnalytics', 'retrieveUniquenessDataForCafe', data),
    resolveIngredientsMenu: (data) =>
        dataHandler.sendRequest('menuAnalytics', 'resolveIngredientsMenu', data),
    getShutdownCafeState: (data) =>
        dataHandler.sendRequest('menuAnalytics', 'getShutdownCafeState', data),
    retrieveVisitData: (data) =>
        dataHandler.sendRequest('menuAnalytics', 'retrieveVisitData', data),
};
