import { IMenuItemBase } from '@msdining/common/models/cafe';
import { ILocationCoordinates } from '@msdining/common/models/util';
import { Nullable } from './util.js';

interface ICafeBase {
    name: string;
    id: string;
    shortName?: number | string;
    aliases?: string[];
    firstAvailable?: Date;
    url?: string;
    emoji?: string;
}

interface ICafeWithoutLocation extends ICafeBase {
    location?: undefined;
}

interface ICafeWithLocation extends ICafeBase {
    location: ILocationCoordinates;
	otherServedBuildings?: Array<string | number>;
}

export type ICafe = ICafeWithoutLocation | ICafeWithLocation;

interface IBaseCafeGroup {
    id: string;
    name: string;
    shortName?: number | string;
    aliases?: string[];
    // Some groups are just there for categorization when we don't group (e.g. restaurants, individual cafes)
    // and we don't actually want to group them in the nav bar.
    alwaysExpand?: boolean;
}

interface ICafeGroupWithLocationOnMembers extends IBaseCafeGroup {
    location?: undefined;
    members: ICafeWithLocation[];
}

export interface ICafeGroupWithLocationOnGroup extends IBaseCafeGroup {
    location: ILocationCoordinates;
    members: ICafe[];
	otherServedBuildings?: Array<string | number>;
}

export type CafeGroup = ICafeGroupWithLocationOnMembers | ICafeGroupWithLocationOnGroup;

export interface ICafeConfig {
    tenantId: string;
    contextId: string;
    displayProfileId: string;
    storeId: string;
    externalName: string;
    logoName?: Nullable<string>;
    isShutDown: boolean;
    shutDownMessage?: string | null;
    /**
     * The full storeInfo block as returned by GET /config (`storeList[0].storeInfo`).
     * The BoD UI echoes this object verbatim in POSTs to the pay-config endpoint
     * — the server uses fields like `timezone` to scope schedule resolution, so
     * omitting it (or sending a stripped-down version) can cause the server to
     * decide the store is closed and return CONCEPTS_NOT_AVAILABLE.
     *
     * Optional because the DB-fallback path doesn't have it (we never persisted
     * it). Callers that need it should treat absence as "missing storeInfo" and
     * fail closed rather than substituting an empty object.
     */
    storeInfo?: Record<string, unknown>;
}

export interface ICafeStation {
    id: string;
    menuId: string;
	cafeId: string;
	groupId: Nullable<string>;
    name: string;
    logoUrl?: string;
    menuItemIdsByCategoryName: Map<string, Array<string>>;
    menuItemsById: Map<string, IMenuItemBase>;
    menuLastUpdateTime?: Date;
    opensAt: number;
    closesAt: number;
}

export interface IMenuItemTag {
    id: string;
    name: string;
}

export { IMenuItemBase };