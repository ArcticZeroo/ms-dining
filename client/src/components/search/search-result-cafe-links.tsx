import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../constants/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeView } from '../../models/cafe.ts';
import { getViewMenuUrl } from '../../util/link.ts';

interface ISearchResultCafeLinksProps {
    cafeId?: string;
    entityView?: CafeView;
    name: string;
}

export const SearchResultCafeLinks: React.FC<ISearchResultCafeLinksProps> = ({ cafeId, entityView, name }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    if (!entityView) {
        return null;
    }

    return (
        <>
            <Link
                to={getViewMenuUrl({
                    view: entityView,
                    viewsById,
                    shouldUseGroups,
                })}
                className="search-result-link flex default-button default-container flex-center"
                title={`Click to view menu for "${name}"`}
            >
                <span className="material-symbols-outlined">
                    restaurant_menu
                </span>
                View Menu
            </Link>
            <Link
                to={`/map/overview/${cafeId}`}
                className="search-result-link flex default-button default-container flex-center"
                title={`Details and overview for "${name}"`}
            >
                <span className="material-symbols-outlined">
                    map
                </span>
                Details + Overview
            </Link>
        </>
    );
};
