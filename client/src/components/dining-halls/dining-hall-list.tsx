import React from 'react';
import { IDiningHall } from '../../models/dining-halls.ts';
import { NavLink } from 'react-router-dom';

interface IDiningHallListProps {
    diningHalls: IDiningHall[];
}

export const DiningHallList: React.FC<IDiningHallListProps> = ({ diningHalls }) => {
    return (
        <ul>
            {
                diningHalls.map((diningHall) => (
                    <li key={diningHall.id}>
                        <NavLink to={`/menu/${diningHall.id}`}>
                            {diningHall.name}
                        </NavLink>
                    </li>
                ))
            }
        </ul>
    );
}