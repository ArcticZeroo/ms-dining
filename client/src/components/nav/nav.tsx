import React, { useContext, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { NavExpansionContext } from '../../context/nav.ts';
import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';
import { classNames } from '../../util/react.ts';
import { NavCafeList } from './nav-cafe-list.tsx';
import { NavListHeaderItems } from './nav-header-buttons.tsx';
import { useIsAdmin } from '../../hooks/auth.js';
import { NavClosingLink } from '../button/nav-closing-link.tsx';

import './nav.css';

export const Nav: React.FC = () => {
    const location = useLocation();
    const [isExpanded, setIsExpanded] = useContext(NavExpansionContext);
    const deviceType = useDeviceType();
    const isAdmin = useIsAdmin();

    useEffect(() => {
        setIsExpanded(false);
    }, [location.pathname, setIsExpanded]);

    const visibilityToggleButton = useMemo(
        () => {
            if (deviceType === DeviceType.Desktop) {
                return null;
            }

            return (
                <a 
                    onClick={() => setIsExpanded(!isExpanded)} 
                    className="link-button visibility-toggle centered-content"
                >
                    <span className="material-symbols-outlined">
                        menu
                    </span>
                </a>
            );
        },
        [deviceType, isExpanded, setIsExpanded]
    );

    return (
        <nav className={classNames(isExpanded && 'expanded', deviceType === DeviceType.Mobile && !isExpanded && 'collapsed')}>
            {!isExpanded && visibilityToggleButton}
            <ul id="sticky-header-list" className="expandable-nav-list default-background">
                {/* Move to here while expanded so that it is sticky with the rest of the nav */}
                {isExpanded && visibilityToggleButton}
                <NavListHeaderItems/>
            </ul>
            <NavCafeList/>
            <ul className="expandable-nav-list default-background">
                <li>
                    <NavClosingLink to="/cheap" className="link-button info" title="Cheap Items Page">
                        <span className="material-symbols-outlined">
                            attach_money
                        </span>
                    </NavClosingLink>
                </li>
                <li>
                    <NavClosingLink to="/info" className="link-button info" title="Info Page">
                        <span className="material-symbols-outlined">
                            info
                        </span>
                    </NavClosingLink>
                </li>
                {
                    isAdmin && (
                        <li>
                            <NavClosingLink to="/dev" className="link-button dev" title="Developer Page">
                                <span className="material-symbols-outlined">
                                    build
                                </span>
                            </NavClosingLink>
                        </li>
                    )
                }
            </ul>
        </nav>
    );
};