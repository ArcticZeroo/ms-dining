import { IMenuItem, IMenuItemModifier, IMenuItemModifierChoice } from '@msdining/common/models/cafe';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { Nullable } from '@msdining/common/models/util';
import { ICafeStation } from '../../../models/cafe.ts';

export interface IIngredientsMenu {
    price: number;
    logoUrl: Nullable<string>;
    starterChoices: IMenuItem[];
    entreeChoices: IMenuItem[];
    dessertChoices: IMenuItem[];
    drinkChoices: IMenuItem[];
    sideChoices: IMenuItem[];
    otherItems: IMenuItem[];
}

const findMatchingItem = (
    modifierChoice: IMenuItemModifierChoice,
    candidates: IMenuItem[]
): IMenuItem | undefined => {
    const normalizedChoiceName = normalizeNameForSearch(modifierChoice.description);

    // Try exact normalized name match
    const exactMatch = candidates.find(
        item => normalizeNameForSearch(item.name) === normalizedChoiceName
    );
    if (exactMatch) {
        return exactMatch;
    }

    // Try containment match on name (either direction)
    const containmentMatch = candidates.find(item => {
        const normalizedItemName = normalizeNameForSearch(item.name);
        return normalizedItemName.includes(normalizedChoiceName)
            || normalizedChoiceName.includes(normalizedItemName);
    });
    if (containmentMatch) {
        return containmentMatch;
    }

    // Try containment match on description (for desserts like "Sweet" whose description contains "Flourless Chocolate Cake")
    return candidates.find(item => {
        if (!item.description) {
            return false;
        }
        const normalizedDescription = normalizeNameForSearch(item.description);
        return normalizedDescription.includes(normalizedChoiceName);
    });
};

const isThreeCourseMealCategory = (name: string) => normalizeNameForSearch(name) === normalizeNameForSearch('3 Course Meal');

// Not every entree necessarily has starter/dessert modifiers (human data entry error),
// so search across all entrees to find the first modifier matching the pattern.
const findModifierAcrossItems = (items: IMenuItem[], pattern: RegExp): IMenuItemModifier | undefined => {
    for (const item of items) {
        const modifier = item.modifiers.find(m => pattern.test(m.description));
        if (modifier) {
            return modifier;
        }
    }
    return undefined;
};

const isALaCarteVersionOfEntree = (item: IMenuItem, entreeNormalizedNames: Set<string>): boolean => {
    const normalizedName = normalizeNameForSearch(item.name);
    for (const entreeName of entreeNormalizedNames) {
        if (normalizedName.includes(entreeName) || entreeName.includes(normalizedName)) {
            return true;
        }
    }
    return false;
};

export const parseIngredientsMenu = (stations: ICafeStation[]): IIngredientsMenu | null => {
    if (stations.length !== 1) {
        return null;
    }

    const station = stations[0]!;
    const threeCourseMealMenuItems: IMenuItem[] = [];
    const nonCourseItems: IMenuItem[] = [];

    for (const [categoryName, items] of Object.entries(station.menu)) {
        if (isThreeCourseMealCategory(categoryName)) {
            threeCourseMealMenuItems.push(...items);
        } else {
            nonCourseItems.push(...items);
        }
    }

    if (threeCourseMealMenuItems.length === 0) {
        return null;
    }

    const starterChoiceModifier = findModifierAcrossItems(threeCourseMealMenuItems, /starter|amuse/i);
    const dessertChoiceModifier = findModifierAcrossItems(threeCourseMealMenuItems, /dessert|finish/i);

    if (!starterChoiceModifier || !dessertChoiceModifier) {
        return null;
    }

    // Match modifier choices against ALL non-course items (not just à la carte category)
    const starterChoices = starterChoiceModifier.choices
        .map(choice => findMatchingItem(choice, nonCourseItems))
        .filter((item): item is IMenuItem => item != null);

    const dessertChoices = dessertChoiceModifier.choices
        .map(choice => findMatchingItem(choice, nonCourseItems))
        .filter((item): item is IMenuItem => item != null);

    // If the menu data is incorrectly entered (e.g. modifier choices don't match actual items),
    // require at least 2 matched starters and 2 matched desserts to consider the menu parseable.
    if (starterChoices.length < 2 || dessertChoices.length < 2) {
        return null;
    }

    const entreeNormalizedNames = new Set(
        threeCourseMealMenuItems.map(item => normalizeNameForSearch(item.name))
    );

    const usedItemIds = new Set([
        ...threeCourseMealMenuItems.map(item => item.id),
        ...starterChoices.map(item => item.id),
        ...dessertChoices.map(item => item.id),
    ]);

    const additionalOfferings = nonCourseItems.filter(item => {
        if (usedItemIds.has(item.id)) {
            return false;
        }
        // Filter out à la carte versions of entrees (e.g. "Steak Frites* - À la carte")
        if (isALaCarteVersionOfEntree(item, entreeNormalizedNames)) {
            return false;
        }
        return true;
    });

    return {
        price:          threeCourseMealMenuItems[0]!.price,
        logoUrl:        station.logoUrl,
        entreeChoices:  threeCourseMealMenuItems,
        starterChoices,
        dessertChoices,
        drinkChoices:   [],
        sideChoices:    [],
        otherItems:     additionalOfferings,
    };
};
