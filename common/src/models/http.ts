import { ILocationCoordinates } from './util.js';

export interface IDiningCoreGroupMemberBase {
    name: string;
    id: string;
    number?: number;
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
    number?: number;
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