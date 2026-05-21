import type { IMenuItemBase } from '@msdining/common/models/cafe';
import type { IMenuItemService } from '../../../../shared/services/menu-item.js';
import { MenuItemStorageClient } from './menu-item.js';
import { retrieveFirstMenuItemAppearance } from '../../cache/menu-item-first-appearance.js';

export const menuItemServiceCommands = {
    saveMenuItem: async ({ menuItem, allowUpdateIfExisting }: { menuItem: IMenuItemBase; allowUpdateIfExisting?: boolean }) =>
        MenuItemStorageClient.saveMenuItemAsync(menuItem, allowUpdateIfExisting),
    saveMenuItemSearchTags: async ({ menuItemId, searchTags }: { menuItemId: string; searchTags: string[] }) =>
        MenuItemStorageClient.saveMenuItemSearchTagsAsync(menuItemId, new Set(searchTags)),
    retrieveMenuItem: async ({ id }: { id: string }) =>
        MenuItemStorageClient.retrieveMenuItemAsync(id),
    retrieveFirstMenuItemAppearance: async ({ menuItemId }: { menuItemId: string }) =>
        retrieveFirstMenuItemAppearance(menuItemId),
    retrieveMenuItemsForWeeklyMenu: async (_data: {}) =>
        MenuItemStorageClient.retrieveMenuItemsForWeeklyMenuAsync(),
    retrievePendingSearchTagQueueEntries: async (_data: {}) =>
        MenuItemStorageClient.retrievePendingSearchTagQueueEntries(),
    getExistingSearchTagsForName: async ({ name }: { name: string }) => {
        const set = await MenuItemStorageClient.getExistingSearchTagsForName(name);
        return Array.from(set);
    },
    retrieveAllMenuItemsWithoutGroup: async (_data: {}) =>
        MenuItemStorageClient.retrieveAllMenuItemsWithoutGroup(),
    updateThumbnailHash: async ({ menuItemId, hash }: { menuItemId: string; hash: string }) =>
        MenuItemStorageClient.updateThumbnailHash(menuItemId, hash),
    getCachedMenuItemNames: async (_data: {}) =>
        Array.from(MenuItemStorageClient.cachedMenuItemNames),
    getTopSearchTags: async (_data: {}) =>
        MenuItemStorageClient.topSearchTags,
} satisfies IMenuItemService;
