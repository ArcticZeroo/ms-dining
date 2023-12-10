export interface ICafe {
    name: string;
    id: string;
    groupId?: string;
    firstAvailable?: Date;
}

export interface ICafeGroup {
    id: string;
    name: string;
}

export interface ICafeConfig {
    tenantId: string;
    contextId: string;
    displayProfileId: string;
    logoName?: string;
}

export interface ICafeStation {
    id: string;
    menuId: string;
    name: string;
    logoUrl: string;
    menuItemIdsByCategoryName: Map<string, Array<string>>;
    menuItemsById: Map<string, IMenuItem>;
}

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

export interface IMenuItem {
    id: string;
    price: string;
    name: string;
    calories: string;
    maxCalories: string;
    hasThumbnail: boolean;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    imageUrl?: string;
    description?: string;
    modifiers: IMenuItemModifier[];
    lastUpdateTime?: Date;
}