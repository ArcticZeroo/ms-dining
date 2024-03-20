import { CafeTypes } from '@msdining/common';
import { ILocationCoordinates } from '@msdining/common/dist/models/util.js';
import { Nullable } from './util.js';

interface ICafeBase {
    name: string;
    id: string;
    number?: number;
    firstAvailable?: Date;
    url?: string;
}

interface ICafeWithoutLocation extends ICafeBase {
    location?: undefined;
}

interface ICafeWithLocation extends ICafeBase {
    location: ILocationCoordinates;
}

export type ICafe = ICafeWithoutLocation | ICafeWithLocation;

interface IBaseCafeGroup {
    id: string;
    name: string;
    number?: number;
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
}

export type CafeGroup = ICafeGroupWithLocationOnMembers | ICafeGroupWithLocationOnGroup;

export interface ICafeConfig {
    tenantId: string;
    contextId: string;
    displayProfileId: string;
    storeId: string;
    externalName: string;
    logoName?: Nullable<string>;
}

export interface ICafeStation {
    id: string;
    menuId: string;
    name: string;
    logoUrl?: string;
    menuItemIdsByCategoryName: Map<string, Array<string>>;
    menuItemsById: Map<string, IMenuItem>;
    menuLastUpdateTime?: Date;
}

export interface IMenuItemTag {
    id: string;
    name: string;
}

export interface IMenuItem {
    id: string;
    price: number;
    name: string;
    receiptText?: Nullable<string>;
    calories: number;
    maxCalories: number;
    hasThumbnail: boolean;
    modifiers: CafeTypes.IMenuItemModifier[];
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    imageUrl?: Nullable<string>;
    description?: Nullable<string>;
    lastUpdateTime?: Nullable<Date>;
    tags: string[];
    searchTags: Set<string>;
}