import React, { useContext, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NavExpansionContext } from '../../context/nav.ts';

import './nav.css';
import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';
import { classNames } from '../../util/react.ts';
import { NavCafeList } from './nav-cafe-list.tsx';
import { NavListHeaderItems } from './nav-header-buttons.tsx';

export const Nav: React.FC = () => {
    const location = useLocation();
    const [isExpanded, setIsExpanded] = useContext(NavExpansionContext);
    const deviceType = useDeviceType();

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