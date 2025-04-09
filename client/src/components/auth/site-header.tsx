import './auth.css';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import React from 'react';
import { NavClosingLink } from '../button/nav-closing-link.tsx';

interface ISiteHeaderProps {
    children: React.ReactNode;
}

export const SiteHeader: React.FC<ISiteHeaderProps> = ({ children }) => {
    const isLoggedIn = useIsLoggedIn();

    if (!isLoggedIn) {
        return (
            <NavClosingLink to="/login" id="site-header" isNavLink={false}>
                {children}
                <span>
                    Login
                </span>
            </NavClosingLink>
        );
    }

    return (
        <NavClosingLink className="auth-info" to="/profile" id="site-header" isNavLink={false}>
            {children}
            <span>
                My Profile
            </span>
        </NavClosingLink>
    );
};