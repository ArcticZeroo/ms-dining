import { CafeTypes } from "@msdining/common";

export interface ICafe {
    name: string;
    id: string;
    logoUrl: string;
    group?: string;
}

export interface ICafeGroupWithoutMembers {
    id: string;
    name: string;
}

export interface IViewListResponse {
    cafes: Array<ICafe>;
    groups: Array<ICafeGroupWithoutMembers>;
}

export interface ICafeGroup extends ICafeGroupWithoutMembers {
    members: string[];
}

export enum CafeViewType {
    single,
    group
}

export interface ICafeSingleView {
    type: CafeViewType.single;
    value: ICafe;
}

export interface ICafeGroupView {
    type: CafeViewType.group;
    value: ICafeGroup;
}

export type CafeView = ICafeSingleView | ICafeGroupView;

export interface IMenuItem {
    id: string;
    price: number;
    name: string;
    calories: number;
    maxCalories: number;
    imageUrl?: string;
    description?: string;
    hasThumbnail: boolean;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    modifiers: Array<CafeTypes.IMenuItemModifier>;
}

export interface IMenuItemsByCategoryName {
    [categoryName: string]: Array<IMenuItem>;
}

export interface ICafeStation {
    name: string;
    logoUrl: string;
    menu: IMenuItemsByCategoryName;
}

export type CafeMenu = ICafeStation[];