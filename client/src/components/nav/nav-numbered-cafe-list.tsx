import React, { useMemo } from 'react';
import { CafeView } from '../../models/cafe.ts';
import { NavViewLink } from './nav-view-link.tsx';

interface INavNumberedCafeListProps {
    views: CafeView[];
}

export const NavNumberedCafeList: React.FC<INavNumberedCafeListProps> = ({ views }) => {
    const viewsInOrder = useMemo(
        () => [...views].sort((a, b) => {
            const aValue = a.value.shortName;
            const bValue = b.value.shortName;

            if (typeof aValue !== 'number' || typeof bValue !== 'number') {
                throw new Error('Only numbered short names should be used in this component');
            }

            return aValue - bValue;
        }),
        [views]
    );

    return (
        <ul className="expandable-nav-list nav-numbered-cafe-list">
            {viewsInOrder.map(view => (
                <NavViewLink key={view.value.id} className="nav-numbered-cafe-list-item" view={view}/>
            ))}
        </ul>
    );
}