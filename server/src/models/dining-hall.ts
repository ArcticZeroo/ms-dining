export interface IDiningHall {
    friendlyName: string;
    url: string;
}

export interface IDiningHallConfig {
    tenantId: string;
    contextId: string;
    logoName: string;
    displayProfileId: string;
}

export interface IDiningHallConcept {
    id: string;
    menuId: string;
    name: string;
    logoUrl: string;
    menuItemIdsByCategory: Map<string, Array<string>>;
    menuItemsById: Map<string, IDiningHallMenuItem>;
}

export interface IDiningHallMenuItem {
    id: string;
    price: string;
    displayName: string;
    calories: string;
    maxCalories: string;
}