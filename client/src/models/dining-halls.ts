export interface IDiningHall {
    name: string;
    id: string;
    logoUrl: string;
}

export interface IDiningHallMenuItem {
    id: string;
    price: string;
    displayName: string;
    calories: string;
    maxCalories: string;
    imageUrl?: string;
}

export interface IDiningHallMenuItemsByCategoryName {
    [categoryName: string]: Array<IDiningHallMenuItem>;
}

export interface IDiningHallConcept {
    name: string;
    logoUrl: string;
    menu: IDiningHallMenuItemsByCategoryName;
}