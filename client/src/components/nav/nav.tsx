import React, { useContext } from 'react';
import { IDiningHall } from '../../models/dining-halls.ts';
import { NavLink } from 'react-router-dom';
import menuIcon from '../../assets/menu.svg';
import { NavExpansionContext } from '../../context/nav.ts';
import { SelectedDiningHallContext } from '../../context/dining-hall.ts';
import settingsIcon from '../../assets/settings.svg';
import { SearchBar } from '../search/search-bar.tsx';
import { getDiningHallMenuUrl } from '../../util/link.ts';

interface IDiningHallListProps {
    diningHalls: IDiningHall[];
}

export const Nav: React.FC<IDiningHallListProps> = ({ diningHalls }) => {
    const [isExpanded, setIsExpanded] = useContext(NavExpansionContext);
    const [, setSelectedDiningHall] = useContext(SelectedDiningHallContext);

    const onDiningHallClicked = (diningHall: IDiningHall) => {
        setSelectedDiningHall(diningHall);
        setIsExpanded(false);
    };

    return (
        <nav className={isExpanded ? 'expanded' : ''}>
            <button onClick={() => setIsExpanded(!isExpanded)} className="visibility-toggle">
                <img src={menuIcon} alt="Toggle menu"/>
            </button>
            <ul className="expandable-nav-list">
                <li>
                    <NavLink to="/settings" className="link-button settings" onClick={() => setIsExpanded(false)}>
                        <img src={settingsIcon} alt="Toggle settings"/>
                    </NavLink>
                </li>
                <SearchBar/>
                {
                    diningHalls.map((diningHall) => (
                        <li key={diningHall.id} className="dining-hall">
                            <NavLink to={getDiningHallMenuUrl(diningHall)} onClick={() => onDiningHallClicked(diningHall)}>
                                {diningHall.name}
                            </NavLink>
                        </li>
                    ))
                }
            </ul>
        </nav>
    );
}