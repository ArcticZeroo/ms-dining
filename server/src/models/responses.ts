export interface IDiningHallConfigResponse {
    tenantID: string;
    contextID: string;
    theme: {
        logoImage: string;
    },
    storeList: Array<{
        displayProfileId: string[]
    }>
}

export interface IDiningHallMenuItem {
    categoryId: string;
    name: string;
    items: string[];
}

export interface IDiningHallConceptMenu {
    id: string;
    name: string;
    categories: Array<IDiningHallMenuItem>;
}

export interface IDiningHallConceptListItem {
    id: string;
    name: string;
    image?: string;
    priceLevelConfig: {
        menuId: string;
    };
    menus: Array<IDiningHallConceptMenu>;
}

export interface IDiningHallMenuItemsResponseItem {
    id: string;
    amount: string;
    displayText: string;
    properties: {
        calories: string;
        maxCalories: string;
    };
    image?: string;
}