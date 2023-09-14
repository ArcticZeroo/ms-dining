import { useContext, useEffect, useState } from 'react';
import { SettingsContext } from '../../../context/settings.ts';
import { DiningHallMenu, IDiningHall } from '../../../models/dining-halls.ts';
import { DiningHallClient } from '../../../api/dining.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { ConceptList } from '../../dining-halls/concept/concept-list.tsx';
import { sortDiningHallIds } from '../../../util/sorting.ts';

interface IMenuWithDiningHall {
    diningHall: IDiningHall;
    menu: DiningHallMenu;
}

export const HomePageWithIds = () => {
    const { diningHallsById } = useContext(ApplicationContext);
    const [{ homepageDiningHallIds }] = useContext(SettingsContext);
    const [menuData, setMenuData] = useState<Array<IMenuWithDiningHall>>([]);

    const loadMenuAsync = async (diningHall: IDiningHall): Promise<IMenuWithDiningHall> => {
        const menu = await DiningHallClient.retrieveDiningHallMenu(diningHall.id, false /*shouldCountTowardsLastUsed*/);
        return { diningHall, menu };
    }

    const loadMenusAsync = async () => {
        const menuPromises = [];

        for (const diningHallId of sortDiningHallIds(Array.from(homepageDiningHallIds))) {
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
    }, [diningHallsById, homepageDiningHallIds]);

    return (
        <div className="home-menu">
            {
                menuData.map(({ diningHall, menu }) => (
                    <div className="home-menu-dining-hall" key={diningHall.id}>
                        <div className="home-menu-dining-hall-title">
                            {diningHall.name} Menu
                        </div>
                        <ConceptList concepts={menu}/>
                    </div>
                ))
            }
        </div>
    );
};