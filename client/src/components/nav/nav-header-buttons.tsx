import { SearchBar } from '../search/search-bar.tsx';
import { NavProfileButton } from '../auth/nav-profile-button.tsx';
import { NavClosingLink } from '../button/nav-closing-link.tsx';

export const NavListHeaderItems = () => {
    return (
        <>
            <li id="site-header">
                <img src={'/penguin.svg'} alt="Site Icon"/>
                <NavClosingLink to="/settings" className="settings">
                    <span className="material-symbols-outlined">
                        settings
                    </span>
                </NavClosingLink>
                <NavProfileButton/>
            </li>
            <li>
                <NavClosingLink to="/" className="link-button home">
                    <span className="material-symbols-outlined">
                        home
                    </span>
                </NavClosingLink>
            </li>
            <li>
                <NavClosingLink to="/map" className="link-button info" title="Map Page">
                    <span className="material-symbols-outlined">
                        map
                    </span>
                </NavClosingLink>
            </li>
            <SearchBar/>
        </>
    );
};