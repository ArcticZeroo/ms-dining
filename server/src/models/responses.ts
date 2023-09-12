export interface IDiningHallConfigResponse {
    tenantId: string;
    contextId: string;
    theme: {
        logoImage: string;
    },
    storeList: Array<{
        displayProfileId: string[]
    }>
}

export interface IDiningHallConceptListItem {
    id: string;
    image: string;
    name: string;
    priceLevelConfig: {
        menuId: string;
    };
    menus: Array<{
        id: string;
        name: string;
        categories: Array<{
            categoryId: string;
            name: string;
            items: string[]
        }>
    }>
}

export interface IDiningHallSitesByContextResponse {
    displayOptions: {
        onDemandTerminalId: string;
    };
    conceptInfo: Array<{
        id: string;
        onDemandDisplayText: string;
    }>
}

export interface IDiningHallMenuItemsResponseItem {
    id: string;
    amount: string;
    displayText: string;
    properties: {
        calories: string;
        maxCalories: string;
    }
}