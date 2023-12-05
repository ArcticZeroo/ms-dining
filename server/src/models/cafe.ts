export interface ICafe {
    name: string;
    id: string;
    groupId?: string;
    firstAvailable?: Date;
}

export interface ICafeGroup {
    id: string;
    name: string;
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
    price: string;
    name: string;
    calories: string;
    maxCalories: string;
    hasThumbnail: boolean;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    imageUrl?: string;
    description?: string;
}