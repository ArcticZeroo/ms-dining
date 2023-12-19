import { NavLink } from 'react-router-dom';
import settingsIcon from '../../assets/settings.svg';
import homeIcon from '../../assets/home.svg';
import { SearchBar } from '../search/search-bar.tsx';
import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';

export const NavListHeaderItems = () => {
    const deviceType = useDeviceType();

    return (
        <>
            {
                deviceType === DeviceType.Desktop && (
                    <div id="site-header">
                        <img src={'/penguin.svg'} alt="Site Icon"/>
                        <span>
                                MSDining
                        </span>
                    </div>
                )
            }
            <li>
                <NavLink to="/settings" className="link-button settings">
                    <img src={settingsIcon} alt="Open settings"/>
                </NavLink>
            </li>
            <li>
                <NavLink to="/" className="link-button home">
                    <img src={homeIcon} alt="Navigate home"/>
                </NavLink>
            </li>
            <SearchBar/>
        </>
    );
};