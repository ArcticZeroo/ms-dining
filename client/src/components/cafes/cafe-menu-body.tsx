import { IDelayedPromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import React, { useContext } from 'react';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { RetryButton } from '../button/retry-button.tsx';
import { StationList } from './station/station-list.tsx';
import { StationListSkeleton } from '../skeleton/station-list-skeleton.tsx';
import { IngredientsInfoBanner } from './station/ingredients-menu-view.tsx';
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
    const isIngredients = cafe.id === 'in-gredients';

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
        return (
            <>
                {isIngredients && <IngredientsInfoBanner/>}
                <StationList
                    stations={value.stations}
                    isAvailable={value.isAvailable}
                    isShutDown={value.isShutDown}
                    shutDownMessage={value.shutDownMessage}
                    ingredientsMenu={value?.ingredientsMenu}
                />
            </>
        );
    }

    return (
        <StationListSkeleton/>
    );
}