import { IDiningCoreGroup, IDiningCoreGroupMember, } from '@msdining/common/models/http';
import { IMenuItem, IStationUniquenessData } from '@msdining/common/models/cafe';
import { Nullable } from '@msdining/common/models/util';
import { IIngredientsMenuDTO } from '@msdining/common/models/ingredients';

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
    id: string;
    name: string;
    logoUrl?: Nullable<string>;
    menu: MenuItemsByCategoryName;
    uniqueness: IStationUniquenessData;
    overallRating?: number;
    totalReviewCount?: number;
    opensAt: number;
    closesAt: number;
}

export interface CafeMenu {
    isAvailable: boolean;
    isShutDown?: boolean;
    shutDownMessage?: string;
    stations: ICafeStation[];
    ingredientsMenu?: IIngredientsMenuDTO;
}