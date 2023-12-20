import { CafeTypes } from '@msdining/common';

export interface ICafe {
    name: string;
    id: string;
    number?: number;
    firstAvailable?: Date;
}

export interface ICafeGroup {
    id: string;
    name: string;
    number?: number;
    members: ICafe[];
}

export interface ICafeConfig {
    tenantId: string;
    contextId: string;
    displayProfileId: string;
    logoName?: string;
}

export interface ICafeStation {
    id: string;
    menuId: string;
    name: string;
    logoUrl: string;
    menuItemIdsByCategoryName: Map<string, Array<string>>;
    menuItemsById: Map<string, IMenuItem>;
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
}