import type { IMenuItemBase } from '@msdining/common/models/cafe';
import type { ISearchTagQueueEntry } from '../../worker/queues/search-tags.js';
import { EmptyObject } from '../models/util.js';

export interface IMenuItemService {
    saveMenuItem(data: { menuItem: IMenuItemBase; allowUpdateIfExisting?: boolean }): Promise<void>;
    saveMenuItemSearchTags(data: { menuItemId: string; searchTags: string[] }): Promise<void>;
    retrieveMenuItem(data: { id: string }): Promise<IMenuItemBase | null>;
    retrieveFirstMenuItemAppearance(data: { menuItemId: string }): Promise<string>;
    retrieveMenuItemsForWeeklyMenu(data: EmptyObject): Promise<void>;
    retrievePendingSearchTagQueueEntries(data: EmptyObject): Promise<ISearchTagQueueEntry[]>;
    getExistingSearchTagsForName(data: { name: string }): Promise<string[]>;
    retrieveAllMenuItemsWithoutGroup(data: EmptyObject): Promise<IMenuItemBase[]>;
    updateThumbnailHash(data: { menuItemId: string; hash: string }): Promise<void>;
    getCachedMenuItemNames(data: EmptyObject): Promise<string[]>;
    getTopSearchTags(data: EmptyObject): Promise<string[]>;
}
