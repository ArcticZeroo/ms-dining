import { CafeTypes } from '@msdining/common';

export interface ICafe {
    name: string;
    id: string;
    number?: number;
    firstAvailable?: Date;
    url?: string;
}

export interface ICafeGroup {
    id: string;
    name: string;
    number?: number;
    // Some groups are just there for categorization when we don't group (e.g. restaurants, individual cafes)
    // and we don't actually want to group them in the nav bar.
    alwaysExpand?: boolean;
    members: ICafe[];
}

export interface ICafeConfig {
    tenantId: string;
    contextId: string;
    displayProfileId: string;
    logoName?: string;
    storeId: string;
    externalName: string;
}

export interface ICafeStation {
    id: string;
    menuId: string;
    name: string;
    logoUrl: string;
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
    calories: number;
    maxCalories: number;
    hasThumbnail: boolean;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    imageUrl?: string;
    description?: string;
    modifiers: CafeTypes.IMenuItemModifier[];
    lastUpdateTime?: Date;
    tags: string[];
}