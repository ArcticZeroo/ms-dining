import type { IMenuItemBase } from '../models/cafe.js';
import type { IMenuItemDTO } from '../models/cafe.js';

/**
 * Convert an in-memory IMenuItemBase (with Sets + Date) to the wire-safe
 * IMenuItemDTO (with arrays + epoch ms). Used on the server before
 * sending menu item data over HTTP.
 *
 * Does NOT include review headers or first appearance — callers that
 * need those (e.g. the daily menu view) should spread them in separately.
 */
export const menuItemBaseToDTO = (item: IMenuItemBase): Omit<IMenuItemDTO, 'totalReviewCount' | 'overallRating' | 'firstAppearance'> => ({
    ...item,
    lastUpdateTime: item.lastUpdateTime?.getTime?.() ?? undefined,
    tags:           Array.from(item.tags),
    searchTags:     Array.from(item.searchTags),
});

/**
 * Convert a wire-safe IMenuItemDTO (with arrays + epoch ms) to the
 * in-memory IMenuItemBase (with Sets + Date). Used on the client after
 * receiving menu item data over HTTP.
 */
export const menuItemDTOToBase = (dto: IMenuItemDTO): IMenuItemBase => ({
    ...dto,
    lastUpdateTime: dto.lastUpdateTime != null ? new Date(dto.lastUpdateTime) : undefined,
    tags:           new Set(dto.tags),
    searchTags:     new Set(dto.searchTags),
});
