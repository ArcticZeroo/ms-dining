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
}

export interface IDiningHallConcept {
    name: string;
    logoUrl: string;
    menu: {
        [categoryName: string]: Array<IDiningHallMenuItem>;
    }
}