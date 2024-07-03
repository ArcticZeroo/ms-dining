import { Nullable } from './util.js';
import { IAvailabilityPattern } from './pattern.js';

export const ModifierChoices = {
	radio:       'radio',
	checkbox:    'checkbox',
	multiSelect: 'multiSelect'
} as const;

export type ModifierChoiceType = typeof ModifierChoices[keyof typeof ModifierChoices];

export interface IMenuItemModifierChoice {
	id: string;
	description: string;
	price: number;
}

export interface IMenuItemModifier {
	id: string;
	description: string;
	minimum: number;
	maximum: number;
	choiceType: ModifierChoiceType;
	choices: IMenuItemModifierChoice[];
}

export interface IStationUniquenessData {
    isTraveling: boolean;
	daysThisWeek: number;
	// keys are the number of days, values are the number of items that were in the station for that many days.
	// e.g. 2: 5 means that five items were in the station for two different days.
	itemDays: Record<number, number>;
}

export interface IMenuItem {
    id: string;
    price: number;
    name: string;
    receiptText?: Nullable<string>;
    calories: number;
    maxCalories: number;
    hasThumbnail: boolean;
    modifiers: IMenuItemModifier[];
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    imageUrl?: Nullable<string>;
    description?: Nullable<string>;
    lastUpdateTime?: Nullable<Date>;
    tags: Set<string>;
    searchTags: Set<string>;
	pattern: Nullable<IAvailabilityPattern>;
}

export interface IMenuItemDTO {
    id: string;
    price: number;
    name: string;
    receiptText?: Nullable<string>;
    calories: number;
    maxCalories: number;
    hasThumbnail: boolean;
    modifiers: IMenuItemModifier[];
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    imageUrl?: Nullable<string>;
    description?: Nullable<string>;
    lastUpdateTime?: Nullable<Date>;
    tags: string[];
    searchTags: string[];
}

export type StationMenuByCategoryName = Record<string, Array<IMenuItem>>;

export interface ICafeOverviewStation {
    name: string;
    logoUrl?: string;
    uniqueness: IStationUniquenessData;
}

export * from './cart.js';