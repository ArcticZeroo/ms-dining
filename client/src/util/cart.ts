import { CafeTypes } from "@msdining/common";

export const getPriceDisplay = (price: number) => {
    if (price === 0) {
        return '';
    }

    return `$${price.toFixed(2)}`;
}

const getModifierMax = (modifier: CafeTypes.IMenuItemModifier): number => {
    if (modifier.choiceType === CafeTypes.ModifierChoices.multiSelect) {
        return modifier.maximum;
    }

    // Sometimes the service reports back a max which is higher than the number of possible options.
    return Math.min(modifier.maximum, modifier.choices.length);
}

export const getMinMaxDisplay = (modifier: CafeTypes.IMenuItemModifier) => {
    const min = modifier.minimum;
    const max = getModifierMax(modifier);

    if (min === 0 && max === 0) {
        return '';
    }

    if (min === max) {
        return `Choose ${min}`;
    }

    if (min === 0) {
        return `Choose up to ${max}`;
    }

    return `Choose between ${min} and ${max}`;
}

export const getChoiceHtmlId = (modifier: CafeTypes.IMenuItemModifier, choice: CafeTypes.IMenuItemModifierChoice) => {
    return `choice-${modifier.id}-${choice.id}`;
}