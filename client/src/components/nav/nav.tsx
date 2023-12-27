import React, { useContext, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NavExpansionContext } from '../../context/nav.ts';

import './nav.css';
import { NavListHeaderItems } from './nav-header-buttons.tsx';
import { NavCafeList } from './nav-cafe-list.tsx';

export const Nav: React.FC = () => {
    const location = useLocation();
    const [isExpanded, setIsExpanded] = useContext(NavExpansionContext);

    useEffect(() => {
        setIsExpanded(false);
    }, [location.pathname, setIsExpanded]);

    const visibilityToggleButton = (
        <button onClick={() => setIsExpanded(!isExpanded)} className="visibility-toggle">
            <span className="material-symbols-outlined">
                menu
            </span>
        </button>
    );

    return (
        <nav className={isExpanded ? 'expanded' : ''}>
            {!isExpanded && visibilityToggleButton}
            <ul id="sticky-header-list" className="expandable-nav-list">
                {isExpanded && visibilityToggleButton}
                <NavListHeaderItems/>
            </ul>
            <NavCafeList/>
            <ul className="expandable-nav-list">
                <li>
                    <NavLink to="/cheap" className="link-button info" title="Cheap Items Page">
                        <span className="material-symbols-outlined">
                            attach_money
                        </span>
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/info" className="link-button info" title="Info Page">
                        <span className="material-symbols-outlined">
                            info
                        </span>
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
};