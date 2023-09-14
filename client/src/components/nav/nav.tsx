import React, { useContext } from 'react';
import { IDiningHall } from '../../models/dining-halls.ts';
import { NavLink } from 'react-router-dom';
import menuIcon from '../../assets/menu.svg';
import { NavVisibilityContext } from '../../context/nav.ts';
import { SelectedDiningHallContext } from '../../context/dining-hall.ts';
import settingsIcon from '../../assets/settings.svg';

interface IDiningHallListProps {
    diningHalls: IDiningHall[];
}

export const Nav: React.FC<IDiningHallListProps> = ({ diningHalls }) => {
    const [isVisible, setIsVisible] = useContext(NavVisibilityContext);
    const [, setSelectedDiningHall] = useContext(SelectedDiningHallContext);

    const onDiningHallClicked = (diningHall: IDiningHall) => {
        setSelectedDiningHall(diningHall);
        setIsVisible(false);
    };

    return (
        <nav>
            <ul className={`dining-hall-list${isVisible ? ' visible' : ''}`}>
                <li>
                    <NavLink to="/settings" className="link-button settings">
                        <img src={settingsIcon} alt="Toggle settings"/>
                    </NavLink>
                </li>
                <li>
                    <button onClick={() => setIsVisible(!isVisible)} className="visibility-toggle">
                        <img src={menuIcon} alt="Toggle menu"/>
                    </button>
                </li>
                {
                    diningHalls.map((diningHall) => (
                        <li key={diningHall.id} className="dining-hall">
                            <NavLink to={`/menu/${diningHall.id}`} onClick={() => onDiningHallClicked(diningHall)}>
                                {diningHall.name}
                            </NavLink>
                        </li>
                    ))
                }
            </ul>
        </nav>
    );
}