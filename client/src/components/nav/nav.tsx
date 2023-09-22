import React, { useContext, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import homeIcon from '../../assets/home.svg';
import menuIcon from '../../assets/menu.svg';
import settingsIcon from '../../assets/settings.svg';
import { ApplicationContext } from '../../context/app';
import { SelectedViewContext } from '../../context/dining-hall.ts';
import { NavExpansionContext } from '../../context/nav.ts';
import { SettingsContext } from '../../context/settings';
import { DiningHallView, DiningHallViewType } from '../../models/dining-halls.ts';
import { getViewUrl } from '../../util/link.ts';
import { SearchBar } from '../search/search-bar.tsx';

export const Nav: React.FC = () => {
    const { viewsInOrder } = useContext(ApplicationContext);
    const [isExpanded, setIsExpanded] = useContext(NavExpansionContext);
    const [, setSelectedView] = useContext(SelectedViewContext);
    const [{ useGroups }] = useContext(SettingsContext);
    const [visibleViews, setVisibleViews] = useState<Array<DiningHallView>>();

    useEffect(() => {
        const newVisibleViews: DiningHallView[] = [];

        for (const view of viewsInOrder) {
            if (view.type === DiningHallViewType.single) {
                if (!view.value.group || !useGroups) {
                    newVisibleViews.push(view);
                }
            } else if (useGroups) {
                newVisibleViews.push(view);
            }
        }

        setVisibleViews(newVisibleViews);
    }, [viewsInOrder, useGroups]);

    const onViewClicked = (view: DiningHallView) => {
        setSelectedView(view);
        setIsExpanded(false);
    };

    return (
        <nav className={isExpanded ? 'expanded' : ''}>
            <button onClick={() => setIsExpanded(!isExpanded)} className="visibility-toggle">
                <img src={menuIcon} alt="Toggle menu"/>
            </button>
            <ul className="expandable-nav-list">
                <li>
                    <NavLink to="/settings" className="link-button settings" onClick={() => setIsExpanded(false)}>
                        <img src={settingsIcon} alt="Open settings"/>
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/" className="link-button home" onClick={() => setIsExpanded(false)}>
                        <img src={homeIcon} alt="Navigate home"/>
                    </NavLink>
                </li>
                <SearchBar/>
                {
                    visibleViews?.map?.((view) => (
                        <li key={view.value.id} className="dining-hall">
                            <NavLink to={getViewUrl(view)}
                                     onClick={() => onViewClicked(view)}>
                                {view.value.name}
                            </NavLink>
                        </li>
                    ))
                }
                <li>
                    <NavLink to="/info" className="link-button info" onClick={() => setIsExpanded(false)}>
                        <span className="material-symbols-outlined">
                            info
                        </span>
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
}