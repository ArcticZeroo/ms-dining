import { IDelayedPromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import React, { useContext, useEffect } from 'react';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { RetryButton } from '../button/retry-button.tsx';
import { StationList } from './station/station-list.tsx';
import { StationListSkeleton } from '../skeleton/station-list-skeleton.tsx';
import { IngredientsInfoBanner, IngredientsMenuView } from './station/ingredients-menu-view.tsx';
import { DebugSettings } from '../../constants/settings.js';
import { CafeMenu } from '../../models/cafe.js';
import { useValueNotifier } from '../../hooks/events.ts';
import { parseIngredientsMenu } from './station/ingredients-menu-parsing.js';

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

    useEffect(() => {
        retrieveMenu();
    }, [retrieveMenu]);

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
        const isIngredients = cafe.id === 'in-gredients';

        if (isIngredients && ingredientsMenuExperience) {
            const ingredientsMenu = parseIngredientsMenu(value);
            if (ingredientsMenu != null) {
                return <IngredientsMenuView menu={ingredientsMenu}/>;
            }
        }

        return (
            <>
                {isIngredients && <IngredientsInfoBanner/>}
                <StationList stations={value}/>
            </>
        );
    }

    return (
        <StationListSkeleton/>
    );
}