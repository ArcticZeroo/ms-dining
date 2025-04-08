import { IMenuItemDTO, IStationUniquenessData } from './cafe.js';
import { SearchMatchReason } from './search.js';
import { ILocationCoordinates, Nullable } from './util.js';

export interface IDiningCoreEntity {
	name: string;
	id: string;
	shortName?: number | string;
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

// GET /api/dining/
export interface IDiningCoreResponse {
	isTrackingEnabled: boolean;
	groups: IDiningCoreGroup[];
	user?: {
		id: string;
		settings?: {
			favoriteStations: string[];
			favoriteMenuItems: string[];
			homepageIds: string[];
			lastUpdate: number;
		}
	};
}

// GET /api/dining/order/wait/:cafeId?items=$number
export interface IWaitTimeResponse {
	minTime: number;
	maxTime: number;
}

export interface IPriceResponse {
	totalPriceWithTax: number;
	totalPriceWithoutTax: number;
	totalTax: number;
}

export interface IStationDTO {
	name: string;
	// Not all stations have a logo URL apparently?
	logoUrl?: Nullable<string>;
	menu: Record<string /*categoryName*/, Array<IMenuItemDTO>>;
	uniqueness: IStationUniquenessData;
	// todo: revisit this, it seems weird to make this a string instead of json directly
	// maybe we just make patterns use arrays to avoid needing conversion
	pattern?: string;
}

// GET /api/dining/menu/:cafeId
export type MenuResponse = Array<IStationDTO>;

export type AllMenusResponse = Record<string /*cafeId*/, MenuResponse>;

export interface ISearchResponseResult {
	type: 'menuItem' | 'station';
	name: string;
	description?: string;
	imageUrl?: string;
	locations: Record<string, Array<string>>;
	prices: Record<string, number>;
	stations: Record<string /*cafeId*/, string /*stationName*/>;
	matchReasons: Array<SearchMatchReason>;
	tags?: Array<string>;
	searchTags?: Array<string>;
	matchedModifiers: Record<string, Array<string>>;
	vectorDistance?: number;
}

export interface ICreateReviewRequest {
	rating: number;
	cafeId?: string;
	comment?: string;
}

export interface IUpdateReviewRequest {
	rating?: number;
	comment?: string;
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
