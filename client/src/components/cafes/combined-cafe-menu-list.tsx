import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { DiningClient } from '../../api/dining.ts';
import { ApplicationSettings } from '../../api/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useValueNotifier, useValueNotifierContext } from '../../hooks/events.ts';
import { CafeMenu, CafeView, ICafe } from '../../models/cafe.ts';
import { expandAndFlattenView } from '../../util/view.ts';
import { MenuSettings } from '../settings/menu-settings.tsx';
import { CollapsibleCafeMenu } from './collapsible-cafe-menu.tsx';

import './combined-cafes.css';
import { CafeDatePicker } from './date/date-picker.tsx';

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

    const cafes = useMemo(
        () => Array.from(views).flatMap(view => expandAndFlattenView(view, viewsById)),
        [views, viewsById]
    );

    const loadMenusAsync = useCallback(() => {
        const menuPromises: Array<Promise<IMenuWithCafe>> = [];

        for (const cafe of cafes) {
            menuPromises.push(loadMenuAsync(cafe));
        }

        return Promise.all(menuPromises);
    }, [cafes, loadMenuAsync]);

    const { stage, run, value } = useDelayedPromiseState(loadMenusAsync, true /*keepLastValue*/);

    useEffect(() => {
        run();
    }, [run]);

    const menuData: IMenuWithCafe[] = useMemo(
        () => {
            if (!value) {
                return cafes.map(cafe => ({ cafe, menu: [] }));
            }

            return value;
        },
        [value, cafes]
    );

    return [stage, menuData] as const;
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
        <div className="collapsible-menu-list">
            {
                allowFutureMenus && <CafeDatePicker/>
            }
            {
                menuData.map(({ cafe, menu }) => (
                    <CollapsibleCafeMenu
                        key={cafe.id}
                        cafe={cafe}
                        menu={menu}
                        showGroupName={showGroupNames}
                        isLoading={isLoading}
                    />
                ))
            }
            <MenuSettings/>
        </div>
    );
};