import { CafeTypes } from '@msdining/common';

export interface ICafe {
    name: string;
    id: string;
    number?: number;
    groupId?: string;
    firstAvailable?: Date;
}

export interface ICafeGroup {
    id: string;
    name: string;
    number?: number;
}

export interface ICafeConfig {
    tenantId: string;
    contextId: string;
    displayProfileId: string;
    logoName?: string;
}

export interface IMenuItemTag {
    id: string;
    name: string;
    imageName?: string;
}

export interface ICafeStation {
    id: string;
    menuId: string;
    name: string;
    logoUrl: string;
    menuItemIdsByCategoryName: Map<string, Array<string>>;
    menuItemsById: Map<string, IMenuItem>;
    lastUpdateTime?: Date;
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
    tags: IMenuItemTag[];
}