import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';

interface INavNumberedCafeListProps {
    viewNumbersById: Map<string, number>;
}

export const NavNumberedCafeList: React.FC<INavNumberedCafeListProps> = ({ viewNumbersById }) => {
    const numberedCafesList = useMemo(() => {
        const cafeNumberEntries = Array.from(viewNumbersById.entries()).sort(([, a], [, b]) => a - b);

        return cafeNumberEntries.map(([cafeId, cafeNumber]) => (
            <NavLink key={cafeId} className="nav-numbered-cafe-list-item" to={`/menu/${cafeId}`} title={`Menu for Cafe ${cafeNumber}`}>
                {cafeNumber}
            </NavLink>
        ));
    }, [viewNumbersById]);

    return (
        <li className="nav-numbered-cafe-list">
            {numberedCafesList}
        </li>
    );
}