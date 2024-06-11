import { ILocationCoordinates } from '@msdining/common/dist/models/util';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PassiveUserLocationNotifier } from '../../api/location/user-location.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useViewsSortedByDistance } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeView } from '../../models/cafe.ts';
import { getViewMenuUrl } from '../../util/link.ts';
import { LocationAllowButton } from '../button/location-allow-button.tsx';

const VIEW_SUGGESTION_COUNT = 5;

interface INextCafeSuggestionsProps {
    excludeViews: CafeView[];
    location?: ILocationCoordinates;
}

export const NextCafeSuggestions: React.FC<INextCafeSuggestionsProps> = ({ excludeViews, location }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const userLocation = useValueNotifier(PassiveUserLocationNotifier);
    const targetLocation = location || userLocation;

    const viewsSortedByDistance = useViewsSortedByDistance(targetLocation);

    const viewsToShow = useMemo(
        () => {
            if (!targetLocation) {
                return [];
            }

            const excludedViewIds = new Set(excludeViews.map(view => view.value.id));
            const viewsInOrder: CafeView[] = viewsSortedByDistance.filter(view => !excludedViewIds.has(view.value.id));

            return viewsInOrder.slice(0, VIEW_SUGGESTION_COUNT);
        },
        [targetLocation, excludeViews, viewsSortedByDistance]
    );

    if (viewsToShow.length === 0) {
        return null;
    }

    return (
        <div className="flex-col centered-content">
            <div>
                You've hit the end! Check out these other nearby cafeterias:
            </div>
            <div className="flex flex-wrap">
                {
                    viewsToShow.map(view => (
                        <Link key={view.value.id} to={getViewMenuUrl({
                            viewsById,
                            shouldUseGroups,
                            view
                        })} className="chip default-button default-container">
                            {view.value.name}
                        </Link>
                    ))
                }
            </div>
            {
                location == null && (
                    <LocationAllowButton/>
                )
            }
        </div>
    );
}