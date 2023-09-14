import { DiningHallMenu, IDiningHall } from '../../models/dining-halls.ts';
import React, { useState } from 'react';
import { ConceptList } from './concept/concept-list.tsx';

interface IHomePageDiningHallMenuProps {
    diningHall: IDiningHall;
    menu: DiningHallMenu;
}

export const CollapsibleDiningHallMenu: React.FC<IHomePageDiningHallMenuProps> = ({ diningHall, menu }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="combined-dining-hall" key={diningHall.id}>
            <button className="combined-dining-hall-title" onClick={() => setIsExpanded(!isExpanded)}>
                {diningHall.name} Menu
                <span className={`material-symbols-outlined expand-icon ${isExpanded ? 'expanded': 'collapsed'}`}>
                    expand_more
                </span>
            </button>
            <ConceptList concepts={menu} isVisible={isExpanded}/>
        </div>
    );
};