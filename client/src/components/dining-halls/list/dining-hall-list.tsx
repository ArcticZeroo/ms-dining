import React, { useContext } from 'react';
import { IDiningHall } from '../../../models/dining-halls.ts';
import { NavLink } from 'react-router-dom';
import menuIcon from '../../../assets/menu.svg';
import { NavVisibilityContext } from '../../../context/nav.ts';

interface IDiningHallListProps {
    diningHalls: IDiningHall[];
}

export const DiningHallList: React.FC<IDiningHallListProps> = ({ diningHalls }) => {
    const [isVisible, setIsVisible] = useContext(NavVisibilityContext);

    return (
        <nav>
            <button onClick={() => setIsVisible(!isVisible)} className="visibility-toggle">
                <img src={menuIcon} alt="Toggle menu"/>
            </button>
            <ul className={`dining-hall-list${isVisible ? ' visible' : ''}`}>
                {
                    diningHalls.map((diningHall) => (
                        <li key={diningHall.id} className="dining-hall">
                            <NavLink to={`/menu/${diningHall.id}`} onClick={() => setIsVisible(false)}>
                                {diningHall.name}
                            </NavLink>
                        </li>
                    ))
                }
            </ul>
        </nav>
    );
}