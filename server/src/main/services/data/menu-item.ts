import type { IMenuItemService } from '../../../shared/services/menu-item.js';
import { dataHandler } from './handler.js';

export const menuItemService: IMenuItemService = {
    saveMenuItem: (data) =>
        dataHandler.sendRequest('menuItem', 'saveMenuItem', data),
    saveMenuItemSearchTags: (data) =>
        dataHandler.sendRequest('menuItem', 'saveMenuItemSearchTags', data),
    retrieveMenuItem: (data) =>
        dataHandler.sendRequest('menuItem', 'retrieveMenuItem', data),
    retrieveFirstMenuItemAppearance: (data) =>
        dataHandler.sendRequest('menuItem', 'retrieveFirstMenuItemAppearance', data),
    retrieveMenuItemsForWeeklyMenu: (data) =>
        dataHandler.sendRequest('menuItem', 'retrieveMenuItemsForWeeklyMenu', data),
    retrievePendingSearchTagQueueEntries: (data) =>
        dataHandler.sendRequest('menuItem', 'retrievePendingSearchTagQueueEntries', data),
    getExistingSearchTagsForName: (data) =>
        dataHandler.sendRequest('menuItem', 'getExistingSearchTagsForName', data),
    retrieveAllMenuItemsWithoutGroup: (data) =>
        dataHandler.sendRequest('menuItem', 'retrieveAllMenuItemsWithoutGroup', data),
    updateThumbnailHash: (data) =>
        dataHandler.sendRequest('menuItem', 'updateThumbnailHash', data),
    getCachedMenuItemNames: (data) =>
        dataHandler.sendRequest('menuItem', 'getCachedMenuItemNames', data),
    getTopSearchTags: (data) =>
        dataHandler.sendRequest('menuItem', 'getTopSearchTags', data),
};
