import { CafeTypes } from '@msdining/common';
import {
    IDiningCoreGroup, IDiningCoreGroupMember,
} from '@msdining/common/dist/models/http';

export type ICafeGroup = IDiningCoreGroup;
export type ICafe = IDiningCoreGroupMember & { group?: ICafeGroup };

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