import { useContext, useEffect, useState } from 'react';
import { SettingsContext } from '../../../context/settings.ts';
import { Link } from 'react-router-dom';
import { CombinedDiningHallMenuList } from '../../dining-halls/combined-dining-hall-menu-list.tsx';

import './home.css';
import { ApplicationContext } from '../../../context/app.ts';

export const HomePage = () => {
    const { viewsById } = useContext(ApplicationContext);
    const [{ homepageViewIds }] = useContext(SettingsContext);

    // Users may have added dining halls to their home set which are no temporarily unavailable
    const [availableViewIds, setAvailableViewIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const newAvailableViewId = new Set<string>();
        for (const viewId of homepageViewIds) {
            if (viewsById.has(viewId)) {
                newAvailableViewId.add(viewId);
            }
        }
        setAvailableViewIds(newAvailableViewId);
    }, [viewsById, homepageViewIds]);

    if (availableViewIds.size === 0) {
        return (
            <div className="centered-content">
                <div className="card centered">
                    <div className="title">
                        Microsoft Cafeteria Menus Home
                    </div>
                </div>
                <Link to={'/settings'} id="home-settings">
                    <div className="card centered blue">
                        <div className="title">
                            Head to the settings page in order to select homepage dining halls!
                        </div>
                    </div>
                </Link>
            </div>
        );
    }

    return (
        <CombinedDiningHallMenuList diningHallIds={homepageViewIds}/>
    );
};