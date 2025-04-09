import React, { useContext } from 'react';
import { Link, LinkProps, NavLink } from 'react-router-dom';
import { NavExpansionContext } from '../../context/nav.ts';

interface INavClosingLinkProps extends LinkProps {
    isNavLink?: boolean;
}

export const NavClosingLink: React.FC<INavClosingLinkProps> = ({ isNavLink = true, ...props }) => {
    const [, setIsNavExpanded] = useContext(NavExpansionContext);

    const onLinkClicked = (event: React.MouseEvent<HTMLAnchorElement>) => {
        setIsNavExpanded(false);
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