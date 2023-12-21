import { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../api/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView } from '../../../models/cafe.ts';
import { CombinedCafeMenuList } from '../../dining-halls/combined-cafe-menu-list.tsx';

import './home.css';

export const HomePage = () => {
    const { viewsById } = useContext(ApplicationContext);

    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);

    // Users may have added cafes to their home set which are currently unavailable
    const availableViews = useMemo(() => {
        const newAvailableViews: CafeView[] = [];

        for (const viewId of homepageViewIds) {
            if (viewsById.has(viewId)) {
                const view = viewsById.get(viewId)!;
                newAvailableViews.push(view);
            }
        }

        return newAvailableViews;
    }, [viewsById, homepageViewIds]);

    if (availableViews.length === 0) {
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
        <CombinedCafeMenuList
            views={availableViews}
            countTowardsLastUsed={false}
            showGroupNames={true}
        />
    );
};