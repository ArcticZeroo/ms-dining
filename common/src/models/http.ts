import { ICafeShutdownState, IMenuItemDTO, IStationUniquenessData } from './cafe.js';
import { IIngredientsMenuDTO } from './ingredients.js';
import { SearchEntityType, SearchMatchReason } from './search.js';
import { ILocationCoordinates, Nullable } from './util.js';
import { z } from 'zod';

export interface IDiningCoreEntity {
	name: string;
	id: string;
	shortName?: number | string;
	aliases?: string[];
	firstAvailableDate?: string;
}

export interface IDiningCoreGroupMemberBase extends IDiningCoreEntity {
	url?: string;
	logoUrl?: string
	group?: IDiningCoreGroup;
	emoji?: string;
}

interface IDiningCoreGroupMemberWithoutLocation extends IDiningCoreGroupMemberBase {
	location?: undefined;
}

interface IDiningCoreGroupMemberWithLocation extends IDiningCoreGroupMemberBase {
	location: ILocationCoordinates;
}

export type IDiningCoreGroupMember = IDiningCoreGroupMemberWithoutLocation | IDiningCoreGroupMemberWithLocation;

interface IDiningCoreGroupBase extends IDiningCoreEntity {
	alwaysExpand: boolean;
}

interface IDiningCoreGroupWithLocationOnMembers extends IDiningCoreGroupBase {
	location?: undefined;
	members: IDiningCoreGroupMemberWithLocation[];
}

interface IDiningCoreGroupWithLocationOnGroup extends IDiningCoreGroupBase {
	location: ILocationCoordinates;
	members: IDiningCoreGroupMemberWithoutLocation[];
}

export type IDiningCoreGroup = IDiningCoreGroupWithLocationOnMembers | IDiningCoreGroupWithLocationOnGroup;

// ── Response schemas ──────────────────────────────────────────────────
//
// These zod schemas are the source of truth for HTTP response shapes —
// the server constructs objects matching these via `satisfies`, the client
// validates incoming responses with `.parse()`, and integration tests use
// them via the fetchJson() helper. Where embedded types haven't been
// migrated to zod yet (e.g. IMenuItemDTO), z.custom<T>() preserves the
// TypeScript shape but skips runtime validation for those subtrees.

// GET /api/dining/

export const DiningCoreResponseSchema = z.object({
	isTrackingEnabled: z.boolean(),
	groups: z.array(z.custom<IDiningCoreGroup>()),
});

export type IDiningCoreResponse = z.infer<typeof DiningCoreResponseSchema>;

// GET /api/dining/order/wait/:cafeId
export interface IWaitTimeResponse {
	minTime: number;
	maxTime: number;
}

// GET /api/dining/order/estimate/:cafeId
export interface ICartEstimateResponse {
	waitTime: IWaitTimeResponse;
	subtotal: number;
	tax: number;
	total: number;
}

export interface IPriceResponse {
	totalPriceWithTax: number;
	totalPriceWithoutTax: number;
	totalTax: number;
}

export interface IStationDTO {
	id: string;
	name: string;
	// Not all stations have a logo URL apparently?
	logoUrl?: Nullable<string>;
	menu: Record<string /*categoryName*/, Array<IMenuItemDTO>>;
	uniqueness: IStationUniquenessData;
	// todo: revisit this, it seems weird to make this a string instead of json directly
	// maybe we just make patterns use arrays to avoid needing conversion
	pattern?: string;
	overallRating?: number;
	totalReviewCount?: number;
	opensAt: number;
	closesAt: number;
}

// GET /api/dining/menu/:cafeId
export type MenuResponse = Array<IStationDTO>;

/**
 * Runtime schema for the legacy GET /api/dining/menu/:cafeId response.
 * Server returns this shape when the client does NOT send the
 * `menuRouteIsObjectInsteadOfArray` version tag. Tests can validate
 * either shape by selecting between this schema and CafeMenuResponseSchema.
 */
export const MenuResponseSchema = z.array(z.custom<IStationDTO>());

// GET /api/dining/menu/:cafeId/menu

export const CafeMenuResponseSchema = z.object({
	isAvailable: z.boolean(),
	shutdownState: z.custom<ICafeShutdownState>().optional(),
	stations: z.array(z.custom<IStationDTO>()),
	ingredientsMenu: z.custom<IIngredientsMenuDTO>().optional(),
});

export type ICafeMenuResponse = z.infer<typeof CafeMenuResponseSchema>;

export type AllMenusResponse = Record<string /*cafeId*/, MenuResponse>;

// GET /api/dining/search

export const SearchResponseResultSchema = z.object({
	id: z.string(),
	type: z.nativeEnum(SearchEntityType),
	name: z.string(),
	description: z.string().optional(),
	imageUrl: z.string().optional(),
	locations: z.record(z.string(), z.array(z.string())),
	prices: z.record(z.string(), z.number()),
	stations: z.record(z.string(), z.string()),
	matchReasons: z.array(z.nativeEnum(SearchMatchReason)),
	tags: z.array(z.string()).optional(),
	searchTags: z.array(z.string()).optional(),
	matchedModifiers: z.record(z.string(), z.array(z.string())),
	vectorDistance: z.number().optional(),
	cafeId: z.string().optional(),
	overallRating: z.number().optional(),
	totalReviewCount: z.number().optional(),
});

export type ISearchResponseResult = z.infer<typeof SearchResponseResultSchema>;

export const SearchResponseSchema = z.array(SearchResponseResultSchema);
export type ISearchResponse = z.infer<typeof SearchResponseSchema>;

export interface ICreateReviewRequest {
	rating: number;
	cafeId?: string;
	comment?: string;
	anonymous?: boolean;
	displayName?: string;
}

export interface IUpdateReviewRequest {
	rating?: number;
	comment?: string;
	displayName?: string;
}

export interface ICreateReviewResponse {
	id: string;
}

export const REVIEW_MAX_COMMENT_LENGTH_CHARS = 500;

export interface IUpdateUserSettingsInput {
	favoriteStations?: string[];
	favoriteMenuItems?: string[];
	homepageIds?: string[];
	timestamp: number;
}
