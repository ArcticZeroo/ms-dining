import { IMenuItem } from './cafe.js';
import { Nullable } from './util.js';

export interface IDiningCoreGroupMember {
    name: string;
    id: string;
    number?: number;
    url?: string;
    logoUrl?: string
}

export interface IDiningCoreGroup {
    name: string;
    id: string;
    number?: number;
    alwaysExpand: boolean;
    members: IDiningCoreGroupMember[];
}

// GET /api/dining/
export interface IDiningCoreResponse {
    isTrackingEnabled: boolean;
    groups: IDiningCoreGroup[];
}

export interface IMenuResponseStation {
    name: string;
    // Not all stations have a logo URL apparently?
    logoUrl?: Nullable<string>;
    menu: Record<string /*categoryName*/, Array<IMenuItem>>;
}

// GET /api/dining/menu/:cafeId
export type MenuResponse = Array<IMenuResponseStation>;

export type AllMenusResponse = Record<string /*cafeId*/, MenuResponse>;