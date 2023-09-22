export interface IDiningHall {
    name: string;
    id: string;
    logoUrl: string;
    group?: string;
}

export interface IDiningHallGroupWithoutMembers {
    id: string;
    name: string;
}

export interface IViewListResponse {
    diningHalls: Array<IDiningHall>;
    groups: Array<IDiningHallGroupWithoutMembers>;
}

export interface IDiningHallGroup extends IDiningHallGroupWithoutMembers {
    members: string[];
}

export enum DiningHallViewType {
    single,
    group
}

export interface IDiningHallSingleView {
    type: DiningHallViewType.single;
    value: IDiningHall;
}

export interface IDiningHallGroupView {
    type: DiningHallViewType.group;
    value: IDiningHallGroup;
}

export type DiningHallView = IDiningHallSingleView | IDiningHallGroupView;

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

export type DiningHallMenu = IDiningHallConcept[];