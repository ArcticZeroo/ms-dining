import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeView } from '../../models/cafe.ts';
import { getViewMenuUrlDirect } from '../../util/link.ts';
import { classNames } from '../../util/react.ts';
import { NavClosingLink } from '../button/nav-closing-link.tsx';

interface INavViewLinkProps {
    view: CafeView;
    className?: string;
}

export const NavViewLink: React.FC<INavViewLinkProps> = ({ view, className }) => {
    const shouldCondenseNumbers = useValueNotifier(ApplicationSettings.shouldCondenseNumbers);
    const location = useLocation();
    const navigate = useNavigate();
    const { id: oneOrManyIds } = useParams();

    const displayValue = shouldCondenseNumbers && typeof view.value.shortName === 'number'
        ? view.value.shortName
        : view.value.name;

    const idsOnPage = useMemo(
        () => {
            const isMenuPage = location.pathname.startsWith('/menu/');
            if (!isMenuPage || !oneOrManyIds) {
                return [];
            }

            return oneOrManyIds.split('+');
        },
        [location, oneOrManyIds]
    );

    const isActive = useMemo(
        () => idsOnPage.includes(view.value.id),
        [idsOnPage, view.value.id]
    );

    const onClick = (event: React.MouseEvent) => {
        if (!event.ctrlKey) {
            return;
        }

        event.preventDefault();

        // Keep it an array to preserve order
        const resultIds = [...idsOnPage];
        const existingIndex = resultIds.indexOf(view.value.id);
        if (existingIndex !== -1) {
            resultIds.splice(existingIndex, 1);
        } else {
            resultIds.push(view.value.id);
        }

        if (resultIds.length === 0) {
            // User removed all cafes from the current selection, go back home
            navigate('/');
        } else {
            navigate(`/menu/${resultIds.join('+')}`);
        }
    };

    return (
        <li key={view.value.id} className="cafe" title={`Menu for ${view.value.name}`} onClick={onClick}>
            <NavClosingLink to={getViewMenuUrlDirect(view)} className={classNames(isActive && 'active', className)}>
                {displayValue}
            </NavClosingLink>
        </li>
    );
};
