import { ILocationCoordinates } from '@msdining/common/models/util';
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
    locations: ILocationCoordinates[];
}

export const NextCafeSuggestions: React.FC<INextCafeSuggestionsProps> = ({ excludeViews, locations }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const userLocation = useValueNotifier(PassiveUserLocationNotifier);

    const targetLocations = useMemo(
        (): ILocationCoordinates[] => {
            if (locations) {
                return locations;
            }

            if (userLocation) {
                return [userLocation];
            }

            return [];
        },
        [locations, userLocation]
    );

    const viewsSortedByDistance = useViewsSortedByDistance(targetLocations);

    const viewsToShow = useMemo(
        () => {
            if (targetLocations.length === 0) {
                return [];
            }

            const excludedViewIds = new Set(excludeViews.map(view => view.value.id));
            // Even if one of the views is a group and one of the members is excluded, we can still show the group
            // e.g. if you navigated to building4, we should still show foodhall4 as a suggestion since there are other members in the group
            const viewsInOrder: CafeView[] = viewsSortedByDistance.filter(view => !excludedViewIds.has(view.value.id));

            return viewsInOrder.slice(0, VIEW_SUGGESTION_COUNT);
        },
        [targetLocations, excludeViews, viewsSortedByDistance]
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