import React, { useContext, useEffect, useState } from 'react';
import { CafeMenu, CafeViewType, ICafe } from '../../models/cafe.ts';
import { DiningClient } from '../../api/dining.ts';
import { ApplicationContext } from '../../context/app.ts';
import { sortIds } from '../../util/sorting.ts';
import { CollapsibleCafeMenu } from './collapsible-cafe-menu.tsx';

import './combined-cafes.css';

interface IMenuWithCafe {
    cafe: ICafe;
    menu: CafeMenu;
}

interface ICombinedCafeMenuListProps {
    cafeIds: Iterable<string>;
    countTowardsLastUsed: boolean;
}

export const CombinedCafeMenuList: React.FC<ICombinedCafeMenuListProps> = ({ cafeIds, countTowardsLastUsed }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [menuData, setMenuData] = useState<Array<IMenuWithCafe>>([]);

    const loadMenuAsync = async (cafe: ICafe): Promise<IMenuWithCafe> => {
        const menu = await DiningClient.retrieveCafeMenu(cafe.id, countTowardsLastUsed /*shouldCountTowardsLastUsed*/);
        return { cafe, menu };
    }

    const loadMenusAsync = async () => {
        const menuPromises = [];

        for (const cafeId of sortIds(Array.from(cafeIds))) {
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

        setMenuData(await Promise.all(menuPromises));
    };

    useEffect(() => {
        loadMenusAsync()
            .catch(err => console.error('Failed to load menus:', err));
    }, [viewsById, cafeIds]);

    return (
        <div className="collapsible-menu-list">
            {
                menuData.map(({ cafe, menu }) => (
                    <CollapsibleCafeMenu key={cafe.id}
                                         cafe={cafe}
                                         menu={menu} />
                ))
            }
        </div>
    );
};