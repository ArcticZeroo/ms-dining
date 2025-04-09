import { SearchBar } from '../search/search-bar.tsx';
import { SiteHeader } from '../auth/site-header.tsx';
import { NavClosingLink } from '../button/nav-closing-link.tsx';

export const NavListHeaderItems = () => {
    return (
        <>
            <SiteHeader>
                <img src={'/penguin.svg'} alt="Site Icon"/>
            </SiteHeader>
            <li>
                <NavClosingLink to="/settings" className="link-button settings">
                    <span className="material-symbols-outlined">
                        settings
                    </span>
                </NavClosingLink>
            </li>
            <li>
                <NavClosingLink to="/" className="link-button home">
                    <span className="material-symbols-outlined">
                        home
                    </span>
                </NavClosingLink>
            </li>
            <SearchBar/>
        </>
    );
};