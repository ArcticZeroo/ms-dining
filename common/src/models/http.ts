import { ILocationCoordinates } from './util.js';

export interface IDiningCoreGroupMember {
    name: string;
    id: string;
    number?: number;
    url?: string;
    logoUrl?: string
}

export interface IDiningCoreGroupMemberWithLocation extends IDiningCoreGroupMember {
    location: ILocationCoordinates;
}

interface IDiningCoreGroupBase {
    name: string;
    id: string;
    number?: number;
    alwaysExpand: boolean;
}

interface IDiningCoreGroupWithLocationOnMembers extends IDiningCoreGroupBase {
    members: IDiningCoreGroupMemberWithLocation[];
}

interface IDiningCoreGroupWithLocationOnGroup extends IDiningCoreGroupBase {
    location: ILocationCoordinates;
    members: IDiningCoreGroupMember[];
}

export type IDiningCoreGroup = IDiningCoreGroupWithLocationOnMembers | IDiningCoreGroupWithLocationOnGroup;

// GET /api/dining/
export interface IDiningCoreResponse {
    isTrackingEnabled: boolean;
    groups: IDiningCoreGroup[];
}
