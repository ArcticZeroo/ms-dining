import { NavLink } from 'react-router-dom';
import settingsIcon from '../../assets/settings.svg';
import homeIcon from '../../assets/home.svg';
import { SearchBar } from '../search/search-bar.tsx';
import React from 'react';
import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';


interface INavListHeaderItemsProps {
    onClick(): void;
}

export const NavListHeaderItems: React.FC<INavListHeaderItemsProps> = ({ onClick }) => {
    const deviceType = useDeviceType();

    return (
        <>
            {
                deviceType === DeviceType.Desktop && (
                    <div id="site-header">
                        <img src={"/penguin.svg"} alt="Site Icon"/>
                        <span>
                                MSDining
                            </span>
                    </div>
                )
            }
            <li>
                <NavLink to="/settings" className="link-button settings" onClick={onClick}>
                    <img src={settingsIcon} alt="Open settings"/>
                </NavLink>
            </li>
            <li>
                <NavLink to="/" className="link-button home" onClick={onClick}>
                    <img src={homeIcon} alt="Navigate home"/>
                </NavLink>
            </li>
            <SearchBar/>
        </>
    );
}