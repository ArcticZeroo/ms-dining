import { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { CafeView } from '../../../models/cafe.ts';
import { isViewVisible } from '../../../util/view.ts';
import { CombinedCafeMenuList } from '../../cafes/combined-cafe-menu-list.tsx';

export const HomeViews = () => {
    const { viewsById } = useContext(ApplicationContext);

    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);

    // Users may have added cafes to their home set which are currently unavailable
    const availableViews = useMemo(() => {
        const newAvailableViews: CafeView[] = [];

        for (const viewId of homepageViewIds) {
            if (viewsById.has(viewId)) {
                const view = viewsById.get(viewId)!;

                // If the user selected a single view that should be a group, don't show it
                if (isViewVisible(view)) {
                    newAvailableViews.push(view);
                }
            }
        }

        return newAvailableViews;
    }, [viewsById, homepageViewIds]);

    if (availableViews.length === 0) {
        return null;
    }

    return (
        <CombinedCafeMenuList
            views={availableViews}
            countTowardsLastUsed={false}
            showGroupNames={true}
        />
    );
}