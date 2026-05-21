import type { IMenuItemBase } from '../models/cafe.js';
import type { IMenuItemDTO } from '../models/cafe.js';
import { z } from 'zod';

// ─── Zod schemas for menu item wire format ───────────────────────────

export const MenuItemModifierChoiceSchema = z.object({
    id:          z.string(),
    description: z.string(),
    price:       z.number(),
});

export const MenuItemModifierSchema = z.object({
    id:          z.string(),
    description: z.string(),
    minimum:     z.number(),
    maximum:     z.number(),
    choiceType:  z.enum(['radio', 'checkbox', 'multiSelect']),
    choices:     z.array(MenuItemModifierChoiceSchema),
});

/** Validates the wire-format IMenuItemDTO shape. */
export const MenuItemDTOSchema = z.object({
    id:               z.string(),
    cafeId:           z.string(),
    stationId:        z.string(),
    price:            z.number(),
    name:             z.string(),
    receiptText:      z.string().nullish(),
    calories:         z.number(),
    maxCalories:      z.number(),
    hasThumbnail:     z.boolean(),
    thumbnailId:      z.string().optional(),
    modifiers:        z.array(MenuItemModifierSchema),
    thumbnailWidth:   z.number().optional(),
    thumbnailHeight:  z.number().optional(),
    imageUrl:         z.string().nullish(),
    description:      z.string().nullish(),
    lastUpdateTime:   z.number().nullish(),
    firstAppearance:  z.string(),
    tags:             z.array(z.string()),
    searchTags:       z.array(z.string()),
    pattern:          z.string().optional(),
    groupId:          z.string().nullish(),
    totalReviewCount: z.number(),
    overallRating:    z.number(),
});

/**
 * Validates the wire-format DTO then transforms to the in-memory
 * IMenuItemBase shape (string[] → Set, epoch ms → Date).
 */
export const MenuItemBaseSchema = MenuItemDTOSchema.transform((dto): IMenuItemBase => ({
    ...dto,
    lastUpdateTime: dto.lastUpdateTime != null ? new Date(dto.lastUpdateTime) : undefined,
    tags:           new Set(dto.tags),
    searchTags:     new Set(dto.searchTags),
}));

// ─── Manual conversion functions ─────────────────────────────────────

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
