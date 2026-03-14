import { ICafeStation, MenuItemsByCategoryName } from '../models/cafe.js';
import { IIngredientsMenuDTO } from '@msdining/common/models/ingredients';
import { IMenuItem } from '@msdining/common/models/cafe';
import { Nullable } from '@msdining/common/models/util';
import { formatPrice } from './cart.js';

const resolveMenuItemIds = (ids: string[], itemsById: Map<string, IMenuItem>): IMenuItem[] => {
    return ids.filter(id => itemsById.has(id)).map(id => itemsById.get(id)!);
};

const buildItemsById = (fromStation: ICafeStation): Map<string, IMenuItem> => {
    const itemsById = new Map<string, IMenuItem>();
    for (const items of Object.values(fromStation.menu)) {
        for (const item of items) {
            itemsById.set(item.id, item);
        }
    }
    return itemsById;
};

const resolveIngredientsMenuItemSplit = (dto: IIngredientsMenuDTO, fromStation: ICafeStation) => {
    const itemsById = buildItemsById(fromStation);

    return {
        starterChoices: resolveMenuItemIds(dto.starterChoiceIds, itemsById),
        entreeChoices:  resolveMenuItemIds(dto.entreeChoiceIds, itemsById),
        dessertChoices: resolveMenuItemIds(dto.dessertChoiceIds, itemsById),
        drinkChoices:   resolveMenuItemIds(dto.drinkChoiceIds, itemsById),
        sideChoices:    resolveMenuItemIds(dto.sideChoiceIds, itemsById),
        otherItems:     resolveMenuItemIds(dto.otherItemIds, itemsById),
    };
};

const addCategoryIfNotEmpty = (menu: MenuItemsByCategoryName, categoryName: string, items: IMenuItem[]) => {
    if (items.length > 0) {
        menu[categoryName] = items;
    }
}

export const resolveIngredientsMenu = (dto: Nullable<IIngredientsMenuDTO>, stations: ICafeStation[]): ICafeStation[] => {
    if (!dto || stations.length !== 1) {
        return stations;
    }

    const mainStation = stations[0]!;
    const ingredientsMenu = resolveIngredientsMenuItemSplit(dto, mainStation);

    const menu: MenuItemsByCategoryName = {};
    addCategoryIfNotEmpty(menu, 'Starter Choices', ingredientsMenu.starterChoices);
    addCategoryIfNotEmpty(menu, 'Entree Choices', ingredientsMenu.entreeChoices);
    addCategoryIfNotEmpty(menu, 'Dessert Choices', ingredientsMenu.dessertChoices);
    addCategoryIfNotEmpty(menu, 'Drink Choices', ingredientsMenu.drinkChoices);
    addCategoryIfNotEmpty(menu, 'Side Choices', ingredientsMenu.sideChoices);
    addCategoryIfNotEmpty(menu, 'Other Items', ingredientsMenu.otherItems);

    const ingredientsStation: ICafeStation = {
        ...mainStation,
        menu,
        name: `3 Course Meal - ${formatPrice(dto.price)} for Starter + Entree + Dessert`,
    };

    return [ingredientsStation];
}