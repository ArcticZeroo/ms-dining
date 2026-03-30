import { useContext, useMemo } from 'react';
import { ILocationCoordinates } from '@msdining/common/models/util';
import { ApplicationContext } from '../context/app.ts';
import { convertKmToMiles, getDistanceBetweenCoordinates } from '../util/coordinates.ts';
import { getViewLocation, isViewVisibleForNav } from '../util/view.ts';
import { CafeView } from '../models/cafe.ts';
import { useValueNotifierContext } from './events.js';
import { SelectedDateContext } from '../context/time.js';

const MAX_NEARBY_CAFES = 5;

export interface INearestCafe {
    view: CafeView;
    distanceMiles: number;
}

export const useNearestCafes = (origin: ILocationCoordinates, excludeViewId?: string): INearestCafe[] => {
    const { viewsInOrder } = useContext(ApplicationContext);
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    return useMemo(() => {
        const results: INearestCafe[] = [];

        for (const view of viewsInOrder) {
            if (view.value.id === excludeViewId) {
                continue;
            }

            if (!isViewVisibleForNav(view, true /*shouldUseGroups*/, selectedDate)) {
                continue;
            }

            try {
                const location = getViewLocation(view);
                const distanceKm = getDistanceBetweenCoordinates(origin, location);
                results.push({ view, distanceMiles: convertKmToMiles(distanceKm) });
            } catch {
                // Some views may not have location data
            }
        }

        results.sort((a, b) => a.distanceMiles - b.distanceMiles);
        return results.slice(0, MAX_NEARBY_CAFES);
    }, [viewsInOrder, excludeViewId, selectedDate, origin]);
};
