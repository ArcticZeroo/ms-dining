import React, { useContext } from 'react';
import { Link, LinkProps, NavLink, useLocation } from 'react-router-dom';
import { NavExpansionContext } from '../../context/nav.ts';
import { ScrollTopContext } from '../../context/scroll.ts';

interface INavClosingLinkProps extends LinkProps {
    isNavLink?: boolean;
}

export const NavClosingLink: React.FC<INavClosingLinkProps> = ({ isNavLink = true, ...props }) => {
    const [, setIsNavExpanded] = useContext(NavExpansionContext);
    const location = useLocation();
    const scrollToTop = useContext(ScrollTopContext);

    const onLinkClicked = (event: React.MouseEvent<HTMLAnchorElement>) => {
        setIsNavExpanded(false);

        const targetPath = typeof props.to === 'string' ? props.to : props.to.pathname;
        if (targetPath && location.pathname === targetPath) {
            scrollToTop();
        }

        props.onClick?.(event);
    };

    if (isNavLink) {
        return (
            <NavLink
                {...props}
                onClick={onLinkClicked}
            />
        );
    }

    return (
        <Link
            {...props}
            onClick={onLinkClicked}
        />
    );
}