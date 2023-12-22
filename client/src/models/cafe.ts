import { CafeTypes } from '@msdining/common';

export interface ICafe {
    name: string;
    id: string;
    logoUrl: string;
    number?: number;
    url?: string;
    group?: ICafeGroup;
}

export interface ICafeGroup {
    id: string;
    name: string;
    number?: number;
    alwaysExpand: boolean;
    members: ICafe[];
}

export interface IViewListResponse {
    groups: Array<ICafeGroup>;
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
    tags: string[];
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