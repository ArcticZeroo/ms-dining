import { IMenuItemDTO, IStationUniquenessData } from './cafe.js';
import { SearchMatchReason } from './search.js';
import { ILocationCoordinates, Nullable } from './util.js';

export interface IDiningCoreGroupMemberBase {
    name: string;
    id: string;
    shortName?: number | string;
    url?: string;
    logoUrl?: string
    group?: IDiningCoreGroup;
}

interface IDiningCoreGroupMemberWithoutLocation extends IDiningCoreGroupMemberBase {
    location?: undefined;
}

interface IDiningCoreGroupMemberWithLocation extends IDiningCoreGroupMemberBase {
    location: ILocationCoordinates;
}

export type IDiningCoreGroupMember = IDiningCoreGroupMemberWithoutLocation | IDiningCoreGroupMemberWithLocation;

interface IDiningCoreGroupBase {
    name: string;
    id: string;
    shortName?: number | string;
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

export interface IMenuResponseStation {
    name: string;
    // Not all stations have a logo URL apparently?
    logoUrl?: Nullable<string>;
    menu: Record<string /*categoryName*/, Array<IMenuItemDTO>>;
    uniqueness: IStationUniquenessData;
}

// GET /api/dining/menu/:cafeId
export type MenuResponse = Array<IMenuResponseStation>;

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
}
