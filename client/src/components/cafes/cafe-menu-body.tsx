import { IDelayedPromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import React, { useContext, useEffect, useMemo } from 'react';
import { IIngredientsMenuDTO } from '@msdining/common/models/ingredients';
import { IMenuItem } from '@msdining/common/models/cafe';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { RetryButton } from '../button/retry-button.tsx';
import { StationList } from './station/station-list.tsx';
import { StationListSkeleton } from '../skeleton/station-list-skeleton.tsx';
import { IngredientsInfoBanner, IngredientsMenuView } from './station/ingredients-menu-view.tsx';
import { DebugSettings } from '../../constants/settings.js';
import { CafeMenu, ICafeStation } from '../../models/cafe.js';
import { useValueNotifier } from '../../hooks/events.ts';
import { parseIngredientsMenu } from './station/ingredients-menu-parsing.js';
import { IIngredientsMenu } from './station/ingredients-menu-parsing.ts';

const resolveMenuItemIds = (ids: string[], itemsById: Map<string, IMenuItem>): IMenuItem[] => {
    return ids.filter(id => itemsById.has(id)).map(id => itemsById.get(id)!);
};

const buildItemsById = (stations: ICafeStation[]): Map<string, IMenuItem> => {
    const itemsById = new Map<string, IMenuItem>();
    for (const station of stations) {
        for (const items of Object.values(station.menu)) {
            for (const item of items) {
                itemsById.set(item.id, item);
            }
        }
    }
    return itemsById;
};

const resolveIngredientsMenuFromIds = (dto: IIngredientsMenuDTO, stations: ICafeStation[]): IIngredientsMenu => {
    const itemsById = buildItemsById(stations);
    return {
        price:          dto.price,
        logoUrl:        dto.logoUrl,
        starterChoices: resolveMenuItemIds(dto.starterChoiceIds, itemsById),
        entreeChoices:  resolveMenuItemIds(dto.entreeChoiceIds, itemsById),
        dessertChoices: resolveMenuItemIds(dto.dessertChoiceIds, itemsById),
        drinkChoices:   resolveMenuItemIds(dto.drinkChoiceIds, itemsById),
        sideChoices:    resolveMenuItemIds(dto.sideChoiceIds, itemsById),
        otherItems:     resolveMenuItemIds(dto.otherItemIds, itemsById),
    };
};

interface ICollapsibleCafeMenuBodyProps {
    isExpanded: boolean;
    menuData: IDelayedPromiseState<CafeMenu>;
}

export const CafeMenuBody: React.FC<ICollapsibleCafeMenuBodyProps> = ({
    isExpanded,
    menuData: { value, error, run: retrieveMenu, actualStage }
}) => {
    const cafe = useContext(CurrentCafeContext);
    const ingredientsMenuExperience = useValueNotifier(DebugSettings.ingredientsMenuExperience);

    const isIngredients = cafe.id === 'in-gredients';

    useEffect(() => {
        retrieveMenu();
    }, [retrieveMenu]);

    const resolvedIngredientsMenu = useMemo(() => {
        if (!value?.ingredientsMenu || !isIngredients || !ingredientsMenuExperience) {
            return null;
        }
        return resolveIngredientsMenuFromIds(value.ingredientsMenu, value.stations);
    }, [value, isIngredients, ingredientsMenuExperience]);

    if (!isExpanded) {
        return null;
    }

    if (error != null) {
        return (
            <div className="cafe-error centered-content collapse-body">
                Failed to load menu.
                <br/>
                <RetryButton onClick={retrieveMenu} isDisabled={actualStage !== PromiseStage.error}/>
            </div>
        );
    }

    if (value != null) {
        if (isIngredients && ingredientsMenuExperience) {
            // Try server-provided AI categorization first
            if (resolvedIngredientsMenu != null) {
                return <IngredientsMenuView menu={resolvedIngredientsMenu}/>;
            }

            // Fall back to client-side parsing
            const clientParsedMenu = parseIngredientsMenu(value.stations);
            if (clientParsedMenu != null) {
                return <IngredientsMenuView menu={clientParsedMenu}/>;
            }

            // Show raw stations
            return (
                <>
                    <IngredientsInfoBanner/>
                    <StationList stations={value.stations}/>
                </>
            );
        }

        return (
            <>
                {isIngredients && <IngredientsInfoBanner/>}
                <StationList stations={value.stations}/>
            </>
        );
    }

    return (
        <StationListSkeleton/>
    );
}