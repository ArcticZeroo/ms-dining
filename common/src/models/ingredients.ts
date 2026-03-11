import { Nullable } from './util.js';

export interface IIngredientsMenuDTO {
    price: number;
    logoUrl: Nullable<string>;
    starterChoiceIds: string[];
    entreeChoiceIds: string[];
    dessertChoiceIds: string[];
    drinkChoiceIds: string[];
    sideChoiceIds: string[];
    otherItemIds: string[];
}
