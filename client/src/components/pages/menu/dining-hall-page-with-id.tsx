import React, { useCallback } from 'react';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { IDiningHall } from '../../../models/dining-halls.ts';
import { DiningHallClient } from '../../../api/dining.ts';
import {
    CollapsibleDiningHallMenu,
    CollapsibleMenuDisplayType
} from '../../dining-halls/collapsible-dining-hall-menu.tsx';

interface IDiningHallPageWithIdProps {
    diningHall: IDiningHall;
}

export const DiningHallPageWithId: React.FC<IDiningHallPageWithIdProps> = ({ diningHall }) => {
    const retrieveMenuCallback = useCallback(
        () => DiningHallClient.retrieveDiningHallMenu(diningHall.id),
        [diningHall.id]
    );

    const menuPromiseState = useImmediatePromiseState(retrieveMenuCallback);

    if ([PromiseStage.notRun, PromiseStage.running].includes(menuPromiseState.stage)) {
        return (
            <div>
                <div className="loading-spinner"/>
                <div>
                    Loading menu...
                </div>
            </div>
        );
    }

    if (menuPromiseState.stage === PromiseStage.error || !menuPromiseState.value) {
        return (
            <div className="error-card" onClick={() => menuPromiseState.run()}>
                Could not load menu! Click to try again.
            </div>
        );
    }

    const data = menuPromiseState.value;
    return (
        <CollapsibleDiningHallMenu diningHall={diningHall} menu={data} type={CollapsibleMenuDisplayType.singleMenu}/>
    );
};