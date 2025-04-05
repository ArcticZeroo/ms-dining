import { NavLink } from 'react-router-dom';
import { SearchBar } from '../search/search-bar.tsx';
import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';
import { AuthInfo } from '../auth/auth-info.tsx';
import { useValueNotifier } from '../../hooks/events.ts';
import { DebugSettings } from '../../constants/settings.ts';

export const NavListHeaderItems = () => {
    const deviceType = useDeviceType();
    const isAuthEnabled = useValueNotifier(DebugSettings.auth);

    return (
        <>
            {
                deviceType === DeviceType.Desktop && (
                    <div id="site-header">
                        <img src={'/penguin.svg'} alt="Site Icon"/>
                        {
                            isAuthEnabled ?
                                <AuthInfo/>
                                : (
                                    <span>
                                        Dining
                                    </span>
                                )
                        }
                    </div>
                )
            }
            <li>
                <NavLink to="/settings" className="link-button settings">
                    <span className="material-symbols-outlined">
                        settings
                    </span>
                </NavLink>
            </li>
            <li>
                <NavLink to="/" className="link-button home">
                    <span className="material-symbols-outlined">
                        home
                    </span>
                </NavLink>
            </li>
            <SearchBar/>
        </>
    );
};