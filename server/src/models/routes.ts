import { IMenuItem } from './cafe.js';
import { Nullable } from './util.js';
import { IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';

export interface IMenuResponseStation {
    name: string;
    // Not all stations have a logo URL apparently?
    logoUrl?: Nullable<string>;
    menu: Record<string /*categoryName*/, Array<IMenuItem>>;
    uniqueness: IStationUniquenessData | null;
}

// GET /api/dining/menu/:cafeId
export type MenuResponse = Array<IMenuResponseStation>;

export type AllMenusResponse = Record<string /*cafeId*/, MenuResponse>;