import type { IMenuItemBase } from '@msdining/common/models/cafe';
import type { ISearchTagQueueEntry } from '../../worker/queues/search-tags.js';

export interface IMenuItemService {
    saveMenuItem(data: { menuItem: IMenuItemBase; allowUpdateIfExisting?: boolean }): Promise<void>;
    saveMenuItemSearchTags(data: { menuItemId: string; searchTags: string[] }): Promise<void>;
    retrieveMenuItem(data: { id: string }): Promise<IMenuItemBase | null>;
    retrieveFirstMenuItemAppearance(data: { menuItemId: string }): Promise<string>;
    retrieveMenuItemsForWeeklyMenu(data: {}): Promise<void>;
    retrievePendingSearchTagQueueEntries(data: {}): Promise<ISearchTagQueueEntry[]>;
    getExistingSearchTagsForName(data: { name: string }): Promise<string[]>;
    retrieveAllMenuItemsWithoutGroup(data: {}): Promise<IMenuItemBase[]>;
    updateThumbnailHash(data: { menuItemId: string; hash: string }): Promise<void>;
    getCachedMenuItemNames(data: {}): Promise<string[]>;
    getTopSearchTags(data: {}): Promise<string[]>;
}
