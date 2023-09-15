import React, { useContext } from 'react';
import { IDiningHall } from '../../models/dining-halls.ts';
import { NavLink } from 'react-router-dom';
import { NavExpansionContext } from '../../context/nav.ts';
import { SelectedDiningHallContext } from '../../context/dining-hall.ts';
import { SearchBar } from '../search/search-bar.tsx';
import { getDiningHallMenuUrl } from '../../util/link.ts';
import { useDiningHalls } from '../../hooks/dining-halls.ts';
import settingsIcon from '../../assets/settings.svg';
import menuIcon from '../../assets/menu.svg';
import homeIcon from '../../assets/home.svg';

export const Nav: React.FC = () => {
    const diningHalls = useDiningHalls();
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
                        <img src={settingsIcon} alt="Open settings"/>
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/" className="link-button home" onClick={() => setIsExpanded(false)}>
                        <img src={homeIcon} alt="Navigate home"/>
                    </NavLink>
                </li>
                <SearchBar/>
                {
                    diningHalls.map((diningHall) => (
                        <li key={diningHall.id} className="dining-hall">
                            <NavLink to={getDiningHallMenuUrl(diningHall)}
                                     onClick={() => onDiningHallClicked(diningHall)}>
                                {diningHall.name}
                            </NavLink>
                        </li>
                    ))
                }
                <li>
                    <NavLink to="/info" className="link-button info" onClick={() => setIsExpanded(false)}>
                        <span className="material-symbols-outlined">
                            info
                        </span>
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
}