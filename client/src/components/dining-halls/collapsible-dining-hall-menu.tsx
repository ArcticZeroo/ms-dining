import { DiningHallMenu, IDiningHall } from '../../models/dining-halls.ts';
import React, { useContext, useState } from 'react';
import { StationList } from './station/station-list.tsx';
import { SettingsContext } from '../../context/settings.ts';
import { ExpandIcon } from '../icon/expand.tsx';

interface IHomePageDiningHallMenuProps {
    diningHall: IDiningHall;
    menu: DiningHallMenu;
}

export const CollapsibleDiningHallMenu: React.FC<IHomePageDiningHallMenuProps> = ({
                                                                                      diningHall,
                                                                                      menu,
                                                                                  }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [{ showImages }] = useContext(SettingsContext);

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
                    {
                        showImages && (
                            <img src={diningHall.logoUrl}
                                 alt={`${diningHall.name} logo`}
                                 className="logo"
                                 decoding="async"/>
                        )
                    }
                    {diningHall.name} Menu
                    <ExpandIcon isExpanded={isExpanded}/>
                </button>
            </div>
            <StationList stations={menu} isVisible={isExpanded}/>
        </div>
    );
};