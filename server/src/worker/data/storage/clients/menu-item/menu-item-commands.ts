import type { IMenuItemBase } from '@msdining/common/models/cafe';
import type { IMenuItemService } from '../../../../../shared/services/menu-item.js';
import type { IThumbnailExistenceData } from '../../../../../shared/models/thumbnail.js';
import { MenuItemStorageClient } from './menu-item.js';
import { retrieveFirstMenuItemAppearance } from '../../../cache/menu-item-first-appearance.js';
import { THUMBNAIL_THREAD_HANDLER } from '../../../threads/thumbnail.js';
import { logError } from '../../../../../shared/util/log.js';

export const menuItemServiceCommands = {
    saveMenuItem: async ({ menuItem, allowUpdateIfExisting }: { menuItem: IMenuItemBase; allowUpdateIfExisting?: boolean }) =>
        MenuItemStorageClient.saveMenuItemAsync(menuItem, allowUpdateIfExisting),
    saveMenuItemSearchTags: async ({ menuItemId, searchTags }: { menuItemId: string; searchTags: string[] }) =>
        MenuItemStorageClient.saveMenuItemSearchTagsAsync(menuItemId, new Set(searchTags)),
    retrieveMenuItem: async ({ id }: { id: string }) =>
        MenuItemStorageClient.retrieveMenuItemAsync(id),
    retrieveFirstMenuItemAppearance: async ({ menuItemId }: { menuItemId: string }) =>
        retrieveFirstMenuItemAppearance(menuItemId),
    retrieveMenuItemsForWeeklyMenu: async () =>
        MenuItemStorageClient.retrieveMenuItemsForWeeklyMenuAsync(),
    retrievePendingSearchTagQueueEntries: async () =>
        MenuItemStorageClient.retrievePendingSearchTagQueueEntries(),
    getExistingSearchTagsForName: async ({ name }: { name: string }) => {
        const set = await MenuItemStorageClient.getExistingSearchTagsForName(name);
        return Array.from(set);
    },
    retrieveAllMenuItemsWithoutGroup: async () =>
        MenuItemStorageClient.retrieveAllMenuItemsWithoutGroup(),
    updateThumbnailHash: async ({ menuItemId, hash }: { menuItemId: string; hash: string }) =>
        MenuItemStorageClient.updateThumbnailHash(menuItemId, hash),
    getCachedMenuItemNames: async () =>
        Array.from(MenuItemStorageClient.cachedMenuItemNames),
    getTopSearchTags: async () =>
        MenuItemStorageClient.topSearchTags,
    retrieveThumbnailData: async ({ id, imageUrl, lastUpdateTime }: { id: string; imageUrl: string; lastUpdateTime?: Date | null }): Promise<IThumbnailExistenceData> => {
        try {
            const result = await THUMBNAIL_THREAD_HANDLER.sendRequest('thumbnail', 'getThumbnailData', {
                id,
                imageUrl,
                lastUpdateTime,
            });

            if (!result) {
                return { hasThumbnail: false };
            }

            if (result.hash) {
                MenuItemStorageClient.updateThumbnailHash(id, result.hash)
                    .catch(err => logError(`Failed to persist thumbnail hash for ${id}`, err));
            }

            return {
                hasThumbnail:    true,
                thumbnailWidth:  result.width,
                thumbnailHeight: result.height,
                lastUpdateTime:  result.lastUpdateTime,
            };
        } catch (err) {
            logError(`Failed to retrieve thumbnail data for menu item ${id}`, err);
            return { hasThumbnail: false };
        }
    },
} satisfies IMenuItemService;
