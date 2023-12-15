import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CombinedCafeMenuList } from '../../dining-halls/combined-cafe-menu-list.tsx';

import './home.css';
import { ApplicationContext } from '../../../context/app.ts';
import { expandAndFlattenView, isViewVisible } from '../../../util/view.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ICafe } from '../../../models/cafe.ts';

export const HomePage = () => {
    const { viewsById } = useContext(ApplicationContext);

    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const useGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    // We need to expand views into a cafe list
    // Also, users may have added cafes to their home set which are no temporarily unavailable
    const [availableCafes, setAvailableCafes] = useState<Array<ICafe>>([]);

    useEffect(() => {
        const newAvailableCafesById = new Map<string, ICafe>();

        for (const viewId of homepageViewIds) {
            if (viewsById.has(viewId)) {
                const view = viewsById.get(viewId)!;
                if (isViewVisible(useGroups, view)) {
                    for (const cafe of expandAndFlattenView(viewId, viewsById)) {
                        newAvailableCafesById.set(cafe.id, cafe);
                    }
                }
            }
        }
        setAvailableCafes(Array.from(newAvailableCafesById.values()));
    }, [viewsById, homepageViewIds, useGroups]);

    if (availableCafes.length === 0) {
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
                            Head to the settings page in order to select homepage cafes!
                        </div>
                    </div>
                </Link>
            </div>
        );
    }

    return (
        <CombinedCafeMenuList cafes={availableCafes} countTowardsLastUsed={false}/>
    );
};