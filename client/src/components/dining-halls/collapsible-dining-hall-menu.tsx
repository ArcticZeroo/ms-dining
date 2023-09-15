import { DiningHallMenu, IDiningHall } from '../../models/dining-halls.ts';
import React, { useState } from 'react';
import { ConceptList } from './concept/concept-list.tsx';

interface IHomePageDiningHallMenuProps {
    diningHall: IDiningHall;
    menu: DiningHallMenu;
}

export const CollapsibleDiningHallMenu: React.FC<IHomePageDiningHallMenuProps> = ({
                                                                                      diningHall,
                                                                                      menu,
                                                                                  }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleIsExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="collapsible-dining-hall" key={diningHall.id}>
            <div className="dining-hall-header">
                <a className="dining-hall-order-link"
                   href={`https://${diningHall.id}.buy-ondemand.com`}
                   target="_blank">
                    <span className="material-symbols-outlined">
                            open_in_new
                    </span>
                </a>
                <button className="dining-hall-name" onClick={toggleIsExpanded}>
                    {diningHall.name} Menu
                    <span className={`material-symbols-outlined expand-icon ${isExpanded ? 'expanded' : 'collapsed'}`}>
                        expand_more
                    </span>
                </button>
            </div>
            <ConceptList concepts={menu} isVisible={isExpanded}/>
        </div>
    );
};