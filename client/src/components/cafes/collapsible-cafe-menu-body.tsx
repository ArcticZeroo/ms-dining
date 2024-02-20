import React, { useCallback, useContext, useEffect } from 'react';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { CafeMenu } from '../../models/cafe.ts';
import { DiningClient } from '../../api/dining.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useValueNotifierContext } from '../../hooks/events.ts';
import { StationList } from './station/station-list.tsx';
import { IDelayedPromiseState, PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { MenusCurrentlyUpdatingException } from '../../util/exception.ts';
import { RetryButton } from '../button/retry-button.tsx';

const useMenuData = (shouldCountTowardsLastUsed: boolean): IDelayedPromiseState<CafeMenu> => {
    const cafe = useContext(CurrentCafeContext);
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const retrieveMenu = useCallback(
        () => DiningClient.retrieveCafeMenu({
            id: cafe.id,
            date: selectedDate,
            shouldCountTowardsLastUsed
        }),
        [cafe, selectedDate, shouldCountTowardsLastUsed]
    );

    return useDelayedPromiseState(retrieveMenu);
}

interface ICollapsibleCafeMenuBodyProps {
    shouldCountTowardsLastUsed: boolean;
    isExpanded: boolean;
}

export const CollapsibleCafeMenuBody: React.FC<ICollapsibleCafeMenuBodyProps> = ({
    shouldCountTowardsLastUsed,
    isExpanded
}) => {
    const { value, error, run: retrieveMenu, actualStage } = useMenuData(shouldCountTowardsLastUsed);

    useEffect(() => {
        retrieveMenu();
    }, [retrieveMenu]);

    if (error != null) {
        if (error instanceof MenusCurrentlyUpdatingException) {
            return (
                <div className="centered-content collapse-body">
                    The menu for this cafe is currently updating. Please check back soon!
                    <br/>
                    {
                        actualStage === PromiseStage.error && (
                            <RetryButton onClick={retrieveMenu}/>
                        )
                    }
                </div>
            );
        }

        return (
            <div className="centered-content collapse-body">
                Failed to load menu.
                <br/>
                {
                    actualStage === PromiseStage.error && (
                        <RetryButton onClick={retrieveMenu}/>
                    )
                }
            </div>
        );
    }

    if (value != null) {
        return <StationList stations={value} isVisible={isExpanded}/>;
    }

    return (
        <div className="centered-content collapse-body">
            <div className="loading-spinner"/>
            Loading menu...
        </div>
    );
}