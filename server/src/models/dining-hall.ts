export interface IDiningHall {
    internalName: string;
    friendlyName: string;
    url: string;
}

export interface IDiningHallConfig {
    tenantId: string;
    contextId: string;
    logoName: string;
    displayProfileId: string;
}

export interface IDiningHallConceptHeader {
    name: string;
    logoUrl: string;
    menuItemsByCategory: Map<string, Array<string>>;
}