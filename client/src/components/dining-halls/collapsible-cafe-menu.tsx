import { CafeMenu, ICafe } from '../../models/cafe.ts';
import React, { useContext, useState } from 'react';
import { StationList } from './station/station-list.tsx';
import { SettingsContext } from '../../context/settings.ts';
import { ExpandIcon } from '../icon/expand.tsx';

interface ICollapsibleCafeMenuProps {
    cafe: ICafe;
    menu: CafeMenu;
}

export const CollapsibleCafeMenu: React.FC<ICollapsibleCafeMenuProps> = ({
                                                                                      cafe,
                                                                                      menu,
                                                                                  }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [{ showImages }] = useContext(SettingsContext);

    const toggleIsExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="collapsible-cafe" key={cafe.id}>
            <div className="cafe-header">
                <a className="cafe-order-link"
                   href={`https://${cafe.id}.buy-ondemand.com`}
                   target="_blank">
                    <span className="material-symbols-outlined">
                            open_in_new
                    </span>
                </a>
                <button className="cafe-name" onClick={toggleIsExpanded}>
                    {
                        showImages && (
                            <img src={cafe.logoUrl}
                                 alt={`${cafe.name} logo`}
                                 className="logo"/>
                        )
                    }
                    {cafe.name} Menu
                    <ExpandIcon isExpanded={isExpanded}/>
                </button>
            </div>
            <StationList stations={menu} isVisible={isExpanded}/>
        </div>
    );
};