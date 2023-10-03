export interface ICafeConfigResponse {
    tenantID: string;
    contextID: string;
    theme: {
        logoImage: string;
    },
    storeList: Array<{
        displayProfileId: string[]
    }>
}

export interface ICafeStationCategory {
    categoryId: string;
    name: string;
    items: string[];
}

export interface ICafeStationMenu {
    id: string;
    name: string;
    categories: Array<ICafeStationCategory>;
}

export interface ICafeStationListItem {
    id: string;
    name: string;
    image?: string;
    priceLevelConfig: {
        menuId: string;
    };
    menus: Array<ICafeStationMenu>;
}

export interface ICafeMenuItemsResponseItem {
    id: string;
    amount: string;
    displayText: string;
    properties: {
        calories: string;
        maxCalories: string;
    };
    image?: string;
    description?: string;
}