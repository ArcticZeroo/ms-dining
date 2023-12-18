import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import React, { useCallback, useContext, useEffect } from 'react';
import { DiningClient } from '../../api/dining.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useValueNotifier, useValueNotifierContext } from '../../hooks/events.ts';
import { CafeMenu, CafeView, ICafe } from '../../models/cafe.ts';
import { sortCafes, sortViews } from '../../util/sorting.ts';
import { CollapsibleCafeMenu } from './collapsible-cafe-menu.tsx';
import { ApplicationSettings } from '../../api/settings.ts';
import { CafeDatePicker } from './date/date-picker.tsx';
import { classNames } from '../../util/react.ts';

import './combined-cafes.css';
import { expandAndFlattenView } from '../../util/view.ts';
import { ApplicationContext } from '../../context/app.ts';

interface IMenuWithCafe {
    cafe: ICafe;
    menu: CafeMenu;
}

interface ICombinedCafeMenuListProps {
    views: Iterable<CafeView>;
    countTowardsLastUsed: boolean;
    showGroupNames: boolean;
}

const useMenuData = (views: Iterable<CafeView>, viewsById: Map<string, CafeView>, countTowardsLastUsed: boolean) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const loadMenuAsync = useCallback(async (cafe: ICafe): Promise<IMenuWithCafe> => {
        const menu = await DiningClient.retrieveCafeMenu({
            id:                         cafe.id,
            date:                       selectedDate,
            shouldCountTowardsLastUsed: countTowardsLastUsed
        });
        return { cafe, menu };
    }, [selectedDate, countTowardsLastUsed]);

    const loadMenusAsync = useCallback(() => {
        const menuPromises = [];

        for (const view of sortViews(views)) {
            const cafes = sortCafes(expandAndFlattenView(view, viewsById));
            for (const cafe of cafes) {
                menuPromises.push(loadMenuAsync(cafe));
            }
        }

        return Promise.all(menuPromises);
    }, [views, viewsById, loadMenuAsync]);

    const { stage, run, value } = useDelayedPromiseState(loadMenusAsync, true /*keepLastValue*/);

    useEffect(() => {
        run();
    }, [run]);

    return [stage, value ?? []] as const;
};

export const CombinedCafeMenuList: React.FC<ICombinedCafeMenuListProps> = ({
                                                                               views,
                                                                               countTowardsLastUsed,
                                                                               showGroupNames
                                                                           }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [menuDataStage, menuData] = useMenuData(views, viewsById, countTowardsLastUsed);
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const isLoading = menuDataStage === PromiseStage.running;

    return (
        <div className={classNames('collapsible-menu-list', isLoading && 'centered-content')}>
            {
                allowFutureMenus && <CafeDatePicker/>
            }
            {
                menuDataStage === PromiseStage.running && (
                    <div className="centered-content">
                        <div className="loading-spinner"/>
                        Loading menu(s)...
                    </div>
                )
            }
            {
                menuData.map(({ cafe, menu }) => (
                    <CollapsibleCafeMenu
                        key={cafe.id}
                        cafe={cafe}
                        menu={menu}
                        showGroupName={showGroupNames}
                    />
                ))
            }
        </div>
    );
};