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
	daysThisWeek: number;
	// keys are the number of days, values are the number of items that were in the station for that many days.
	// e.g. 2: 5 means that five items were in the station for two different days.
	itemDays: Record<number, number>;
}

export * from './cart.js';