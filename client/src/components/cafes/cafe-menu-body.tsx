import { IDelayedPromiseState, PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import React, { useCallback, useContext, useEffect } from 'react';
import { DiningClient } from '../../api/dining.ts';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useValueNotifierContext } from '../../hooks/events.ts';
import { CafeMenu } from '../../models/cafe.ts';
import { MenusCurrentlyUpdatingException } from '../../util/exception.ts';
import { RetryButton } from '../button/retry-button.tsx';
import { StationList } from './station/station-list.tsx';
import { StationListSkeleton } from '../skeleton/station-list-skeleton.tsx';

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

export const CafeMenuBody: React.FC<ICollapsibleCafeMenuBodyProps> = ({
    shouldCountTowardsLastUsed,
    isExpanded
}) => {
    const { value, error, run: retrieveMenu, actualStage } = useMenuData(shouldCountTowardsLastUsed);

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
        return <StationList stations={value}/>;
    }

    return (
        <StationListSkeleton/>
    );
}