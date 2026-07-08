import './auth.css';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { NavClosingLink } from '../button/nav-closing-link.tsx';

export const NavProfileButton = () => {
    const isLoggedIn = useIsLoggedIn();

    if (!isLoggedIn) {
        return (
            <NavClosingLink to="/login">
                Login
            </NavClosingLink>
        );
    }

    return (
        <NavClosingLink to="/profile">
            My Profile
        </NavClosingLink>
    );
};