import { DiningHallMenu, IDiningHall } from '../../../models/dining-halls.ts';
import React, { useState } from 'react';
import { ConceptList } from '../../dining-halls/concept/concept-list.tsx';

interface IHomePageDiningHallMenuProps {
    diningHall: IDiningHall;
    menu: DiningHallMenu;
}

export const HomePageDiningHallMenu: React.FC<IHomePageDiningHallMenuProps> = ({ diningHall, menu }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="home-menu-dining-hall" key={diningHall.id}>
            <button className="home-menu-dining-hall-title" onClick={() => setIsExpanded(!isExpanded)}>
                {diningHall.name} Menu
                <span className={`material-symbols-outlined expand-icon ${isExpanded ? 'expanded': 'collapsed'}`}>
                    expand_more
                </span>
            </button>
            <ConceptList concepts={menu} isVisible={isExpanded}/>
        </div>
    );
};