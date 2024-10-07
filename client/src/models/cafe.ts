import {
    IDiningCoreGroup, IDiningCoreGroupMember,
} from '@msdining/common/dist/models/http';
import { IMenuItem, IStationUniquenessData } from '@msdining/common/dist/models/cafe';
import { Nullable } from '@msdining/common/dist/models/util';

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

export type MenuItemsByCategoryName = Record<string, Array<IMenuItem>>;

export interface ICafeStation {
    name: string;
    logoUrl?: Nullable<string>;
    menu: MenuItemsByCategoryName;
    uniqueness: IStationUniquenessData;
}

export type CafeMenu = ICafeStation[];