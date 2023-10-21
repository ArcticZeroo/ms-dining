export interface ICafe {
    name: string;
    url: string;
    groupId?: string;
}

export interface ICafeGroup {
    id: string;
    name: string;
}

export interface ICafeConfig {
    tenantId: string;
    contextId: string;
    logoName: string;
    displayProfileId: string;
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
    displayName: string;
    calories: string;
    maxCalories: string;
    hasThumbnail: boolean;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    imageUrl?: string;
    description?: string;
}