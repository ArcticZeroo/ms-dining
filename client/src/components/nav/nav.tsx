import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import menuIcon from '../../assets/menu.svg';
import { SelectedViewContext } from '../../context/view.ts';
import { NavExpansionContext } from '../../context/nav.ts';
import { CafeView } from '../../models/cafe.ts';

import './nav.css';
import { NavListHeaderItems } from './nav-header-buttons.tsx';
import { NavCafeList } from './nav-cafe-list.tsx';

export const Nav: React.FC = () => {
    const [isExpanded, setIsExpanded] = useContext(NavExpansionContext);
    const [, setSelectedView] = useContext(SelectedViewContext);

    const onViewClicked = (view: CafeView) => {
        setSelectedView(view);
        setIsExpanded(false);
    };

    const visibilityToggleButton = (
        <button onClick={() => setIsExpanded(!isExpanded)} className="visibility-toggle">
            <img src={menuIcon} alt="Toggle menu"/>
        </button>
    );

    return (
        <nav className={isExpanded ? 'expanded' : ''}>
            { !isExpanded && visibilityToggleButton }
            <ul id="sticky-header-list" className="expandable-nav-list">
                { isExpanded && visibilityToggleButton }
                <NavListHeaderItems closeNav={() => setIsExpanded(false)}/>
            </ul>
            <NavCafeList onViewSelected={onViewClicked}/>
            <ul className="expandable-nav-list">
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