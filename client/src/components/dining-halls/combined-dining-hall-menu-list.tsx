import React, { useContext, useEffect, useState } from 'react';
import { DiningHallMenu, DiningHallViewType, IDiningHall } from '../../models/dining-halls.ts';
import { DiningHallClient } from '../../api/dining.ts';
import { ApplicationContext } from '../../context/app.ts';
import { sortIds } from '../../util/sorting.ts';
import { CollapsibleDiningHallMenu } from './collapsible-dining-hall-menu.tsx';

import './combined-dining-halls.css';

interface IMenuWithDiningHall {
    diningHall: IDiningHall;
    menu: DiningHallMenu;
}

interface ICombinedDiningHallMenuListProps {
    diningHallIds: Iterable<string>;
    countTowardsLastUsed: boolean;
}

export const CombinedDiningHallMenuList: React.FC<ICombinedDiningHallMenuListProps> = ({ diningHallIds, countTowardsLastUsed }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [menuData, setMenuData] = useState<Array<IMenuWithDiningHall>>([]);

    const loadMenuAsync = async (diningHall: IDiningHall): Promise<IMenuWithDiningHall> => {
        const menu = await DiningHallClient.retrieveDiningHallMenu(diningHall.id, countTowardsLastUsed /*shouldCountTowardsLastUsed*/);
        return { diningHall, menu };
    }

    const loadMenusAsync = async () => {
        const menuPromises = [];

        for (const diningHallId of sortIds(Array.from(diningHallIds))) {
            const view = viewsById.get(diningHallId);

            if (view == null) {
                console.error('Cannot find view for dining hall with id:', diningHallId);
                continue;
            }

            // TODO: Consider adding support for nested group views in the future
            if (view.type !== DiningHallViewType.single) {
                console.error('View has the wrong view type for dining hall with id:', diningHallId);
                continue;
            }

            menuPromises.push(loadMenuAsync(view.value));
        }

        setMenuData(await Promise.all(menuPromises));
    };

    useEffect(() => {
        loadMenusAsync()
            .catch(err => console.error('Failed to load menus:', err));
    }, [viewsById, diningHallIds]);

    return (
        <div className="collapsible-menu-list">
            {
                menuData.map(({ diningHall, menu }) => (
                    <CollapsibleDiningHallMenu key={diningHall.id}
                                               diningHall={diningHall}
                                               menu={menu} />
                ))
            }
        </div>
    );
};