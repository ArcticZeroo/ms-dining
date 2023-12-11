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

