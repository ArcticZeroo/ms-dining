import { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../../../api/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView } from '../../../models/cafe.ts';
import { CombinedCafeMenuList } from '../../dining-halls/combined-cafe-menu-list.tsx';
import { HomepageViewsSetting } from '../settings/homepage-views-setting.tsx';

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
            <div className="">
                <div className="card centered">
                    <div className="title">
                        Homepage Setup
                    </div>
                    <HomepageViewsSetting requireButtonToCommit={true}/>
                </div>
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