import { useContext, useEffect, useState } from 'react';
import { SettingsContext } from '../../../context/settings.ts';
import { Link } from 'react-router-dom';
import { CombinedCafeMenuList } from '../../dining-halls/combined-cafe-menu-list.tsx';

import './home.css';
import { ApplicationContext } from '../../../context/app.ts';
import { expandAndFlattenView, isViewVisible } from '../../../util/view.ts';

export const HomePage = () => {
    const { viewsById } = useContext(ApplicationContext);
    const [{ homepageViewIds, useGroups }] = useContext(SettingsContext);

    // We need to expand views into a cafe list
    // Also, users may have added cafes to their home set which are no temporarily unavailable
    const [availableCafeIds, setAvailableCafeIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const newAvailableCafeIds = new Set<string>();
        for (const viewId of homepageViewIds) {
            if (viewsById.has(viewId)) {
                const view = viewsById.get(viewId)!;
                if (isViewVisible(useGroups, view)) {
                    for (const cafe of expandAndFlattenView(viewId, viewsById)) {
                        newAvailableCafeIds.add(cafe.id);
                    }
                }
            }
        }
        setAvailableCafeIds(newAvailableCafeIds);
    }, [viewsById, homepageViewIds, useGroups]);

    if (availableCafeIds.size === 0) {
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
        <CombinedCafeMenuList cafeIds={availableCafeIds} countTowardsLastUsed={false}/>
    );
};