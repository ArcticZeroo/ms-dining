import { DiningHallMenu, IDiningHall } from '../../models/dining-halls.ts';
import React, { useState } from 'react';
import { ConceptList } from './concept/concept-list.tsx';

export enum CollapsibleMenuDisplayType {
    collapsible,
    singleMenu
}

interface IHomePageDiningHallMenuProps {
    diningHall: IDiningHall;
    menu: DiningHallMenu;
    type: CollapsibleMenuDisplayType;
}

export const CollapsibleDiningHallMenu: React.FC<IHomePageDiningHallMenuProps> = ({
                                                                                      diningHall,
                                                                                      menu,
                                                                                      type
                                                                                  }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="combined-dining-hall" key={diningHall.id}>
            {
                type === CollapsibleMenuDisplayType.collapsible && (
                    <button className="combined-dining-hall-title" onClick={() => setIsExpanded(!isExpanded)}>
                        {diningHall.name} Menu
                        <span className={`material-symbols-outlined expand-icon ${isExpanded ? 'expanded' : 'collapsed'}`}>
                            expand_more
                        </span>
                    </button>
                )
            }
            {
                type === CollapsibleMenuDisplayType.singleMenu && (
                    <a className="combined-dining-hall-title"
                       href={`https://${diningHall.id}.buy-ondemand.com`}
                       target="_blank">
                        {diningHall.name} Menu
                        <span className="material-symbols-outlined">
                            open_in_new
                        </span>
                    </a>
                )
            }
            <ConceptList concepts={menu} isVisible={type === CollapsibleMenuDisplayType.singleMenu || isExpanded}/>
        </div>
    );
};