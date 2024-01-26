import { ILocationCoordinates } from './util.js';

export interface IDiningCoreGroupMemberBase {
    name: string;
    id: string;
    number?: number;
    url?: string;
    logoUrl?: string
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
