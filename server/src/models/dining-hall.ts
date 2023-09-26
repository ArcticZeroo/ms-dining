export interface IDiningHall {
    name: string;
    url: string;
    groupId?: string;
}

export interface IDiningHallGroup {
    id: string;
    name: string;
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
    menuItemIdsByCategoryName: Map<string, Array<string>>;
    menuItemsById: Map<string, IDiningHallMenuItem>;
}

export interface IDiningHallMenuItem {
    id: string;
    price: string;
    displayName: string;
    calories: string;
    maxCalories: string;
    image?: string;
}