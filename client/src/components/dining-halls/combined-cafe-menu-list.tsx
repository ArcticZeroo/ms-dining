import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import React, { useCallback, useContext, useEffect } from 'react';
import { DiningClient } from '../../api/dining.ts';
import { ApplicationContext } from '../../context/app.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useValueNotifier, useValueNotifierContext } from '../../hooks/events.ts';
import { CafeMenu, CafeViewType, ICafe } from '../../models/cafe.ts';
import { sortCafeIds } from '../../util/sorting.ts';
import { CollapsibleCafeMenu } from './collapsible-cafe-menu.tsx';
import { ApplicationSettings } from '../../api/settings.ts';
import { CafeDatePicker } from './date/date-picker.tsx';
import { classNames } from '../../util/react.ts';

import './combined-cafes.css';

interface IMenuWithCafe {
    cafe: ICafe;
    menu: CafeMenu;
}

interface ICombinedCafeMenuListProps {
    cafeIds: Iterable<string>;
    countTowardsLastUsed: boolean;
}

const useMenuData = (cafeIds: Iterable<string>, countTowardsLastUsed: boolean) => {
    const { viewsById } = useContext(ApplicationContext);
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

        for (const cafeId of sortCafeIds(Array.from(cafeIds))) {
            const view = viewsById.get(cafeId);

            if (view == null) {
                console.error('Cannot find view for cafe with id:', cafeId);
                continue;
            }

            // TODO: Consider adding support for nested group views in the future
            if (view.type !== CafeViewType.single) {
                console.error('View has the wrong view type for cafe with id:', cafeId);
                continue;
            }

            menuPromises.push(loadMenuAsync(view.value));
        }

        return Promise.all(menuPromises);
    }, [cafeIds, viewsById, loadMenuAsync]);

    const { stage, run, value } = useDelayedPromiseState(loadMenusAsync, true /*keepLastValue*/);

    useEffect(() => {
        run();
    }, [run]);

    return [stage, value ?? []] as const;
};

export const CombinedCafeMenuList: React.FC<ICombinedCafeMenuListProps> = ({ cafeIds, countTowardsLastUsed }) => {
    const [menuDataStage, menuData] = useMenuData(cafeIds, countTowardsLastUsed);
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
                    <CollapsibleCafeMenu key={cafe.id}
                        cafe={cafe}
                        menu={menu}/>
                ))
            }
        </div>
    );
};