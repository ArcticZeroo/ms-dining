import React, { useContext, useEffect, useState } from 'react';
import { DiningHallMenu, IDiningHall } from '../../models/dining-halls.ts';
import { DiningHallClient } from '../../api/dining.ts';
import { ApplicationContext } from '../../context/app.ts';
import { sortDiningHallIds } from '../../util/sorting.ts';
import { CollapsibleDiningHallMenu } from './collapsible-dining-hall-menu.tsx';

import './combined-dining-halls.css';

interface IMenuWithDiningHall {
    diningHall: IDiningHall;
    menu: DiningHallMenu;
}

interface ICombinedDiningHallMenuListProps {
    diningHallIds: Iterable<string>;
}

export const CombinedDiningHallMenuList: React.FC<ICombinedDiningHallMenuListProps> = ({ diningHallIds }) => {
    const { diningHallsById } = useContext(ApplicationContext);
    const [menuData, setMenuData] = useState<Array<IMenuWithDiningHall>>([]);

    const loadMenuAsync = async (diningHall: IDiningHall): Promise<IMenuWithDiningHall> => {
        const menu = await DiningHallClient.retrieveDiningHallMenu(diningHall.id, false /*shouldCountTowardsLastUsed*/);
        return { diningHall, menu };
    }

    const loadMenusAsync = async () => {
        const menuPromises = [];

        for (const diningHallId of sortDiningHallIds(Array.from(diningHallIds))) {
            const diningHall = diningHallsById.get(diningHallId);

            if (diningHall == null) {
                console.log('Cannot find dining hall with id:', diningHallId);
                continue;
            }

            menuPromises.push(loadMenuAsync(diningHall));
        }

        setMenuData(await Promise.all(menuPromises));
    };

    useEffect(() => {
        loadMenusAsync()
            .catch(err => console.error('Failed to load menus:', err));
    }, [diningHallsById, diningHallIds]);

    return (
        <div className="combined-menu-list">
            {
                menuData.map(({ diningHall, menu }) => (
                    <CollapsibleDiningHallMenu key={diningHall.id} diningHall={diningHall} menu={menu}/>
                ))
            }
        </div>
    );
};