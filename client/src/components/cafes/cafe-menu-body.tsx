import { IDelayedPromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import React, { useContext, useEffect } from 'react';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { MenusCurrentlyUpdatingException } from '../../util/exception.ts';
import { RetryButton } from '../button/retry-button.tsx';
import { StationList } from './station/station-list.tsx';
import { StationListSkeleton } from '../skeleton/station-list-skeleton.tsx';
import { IngredientsMenuView, parseIngredientsMenu } from './station/ingredients-menu-view.tsx';
import { DebugSettings } from '../../constants/settings.js';
import { CafeMenu } from '../../models/cafe.js';

interface ICollapsibleCafeMenuBodyProps {
    isExpanded: boolean;
    menuData: IDelayedPromiseState<CafeMenu>;
}

export const CafeMenuBody: React.FC<ICollapsibleCafeMenuBodyProps> = ({
    isExpanded,
    menuData: { value, error, run: retrieveMenu, actualStage }
}) => {
    const cafe = useContext(CurrentCafeContext);

    useEffect(() => {
        retrieveMenu();
    }, [retrieveMenu]);

    if (!isExpanded) {
        return null;
    }

    if (error != null) {
        const isMenusCurrentlyUpdating = error instanceof MenusCurrentlyUpdatingException;
        const errorText = isMenusCurrentlyUpdating
            ? 'The menu for this cafe is currently updating. Please check back soon!'
            : 'Failed to load menu.';

        return (
            <div className="cafe-error centered-content collapse-body">
                {errorText}
                <br/>
                <RetryButton onClick={retrieveMenu} isDisabled={actualStage !== PromiseStage.error}/>
            </div>
        );
    }

    if (value != null) {
        if (cafe.id === 'in-gredients' && DebugSettings.ingredientsMenuExperience.value) {
            const ingredientsMenu = parseIngredientsMenu(value);
            if (ingredientsMenu != null) {
                return <IngredientsMenuView menu={ingredientsMenu}/>
            }
        }

        return <StationList stations={value}/>;
    }

    return (
        <StationListSkeleton/>
    );
}