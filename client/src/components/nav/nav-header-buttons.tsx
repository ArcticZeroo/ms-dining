import { NavLink } from 'react-router-dom';
import { SearchBar } from '../search/search-bar.tsx';
import { AuthInfo } from '../auth/auth-info.tsx';

export const NavListHeaderItems = () => {
    return (
        <>
            <div id="site-header">
                <img src={'/penguin.svg'} alt="Site Icon"/>
                <AuthInfo/>
            </div>
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