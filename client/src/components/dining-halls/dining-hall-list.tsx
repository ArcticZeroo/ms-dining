import React from 'react';
import { IDiningHall } from '../../models/dining-halls.ts';
import { NavLink } from 'react-router-dom';

interface IDiningHallListProps {
    diningHalls: IDiningHall[];
}

export const DiningHallList: React.FC<IDiningHallListProps> = ({ diningHalls }) => {
    return (
        <ul className="dining-hall-list">
            {
                diningHalls.map((diningHall) => (
                    <li key={diningHall.id} className="dining-hall">
                        <NavLink to={`/menu/${diningHall.id}`}>
                            {diningHall.name}
                        </NavLink>
                    </li>
                ))
            }
        </ul>
    );
}