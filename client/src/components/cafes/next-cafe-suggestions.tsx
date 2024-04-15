import { ICafe } from '../../models/cafe.ts';
import { useCafesSortedByDistance } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { PassiveUserLocationNotifier } from '../../api/location/user-location.ts';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../context/app.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { getParentView } from '../../util/view.ts';

const VIEW_SUGGESTION_COUNT = 5;

interface INextCafeSuggestionsProps {
    excludeCafes: ICafe[];
}

export const NextCafeSuggestions: React.FC<INextCafeSuggestionsProps> = ({ excludeCafes }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const userLocation = useValueNotifier(PassiveUserLocationNotifier);
    const cafesSortedByDistance = useCafesSortedByDistance(userLocation);

    const cafesToShow = useMemo(
        () => {
            if (!userLocation) {
                return [];
            }

            const cafeIds = new Set(excludeCafes.map(cafe => cafe.id));
            const seenViewIds = new Set<string>();
            const viewsInOrder = [];
            
            for (const nearbyCafe of cafesSortedByDistance) {
                if (cafeIds.has(nearbyCafe.id)) {
                    continue;
                }
                
                const cafeView = viewsById.get(nearbyCafe.id);
                
                if (!cafeView) {
                    throw new Error(`No view found for cafe ${nearbyCafe.id}`);
                }
                
                const parentView = getParentView(viewsById, cafeView, shouldUseGroups);
                
                if (seenViewIds.has(parentView.value.id)) {
                    continue;
                }
                
                seenViewIds.add(parentView.value.id);
                viewsInOrder.push(parentView.value);
            }

            return viewsInOrder.slice(0, VIEW_SUGGESTION_COUNT);
        },
        [excludeCafes, cafesSortedByDistance, shouldUseGroups, userLocation, viewsById]
    );

    if (cafesToShow.length === 0) {
        return null;
    }

    return (
        <div className="flex-col centered-content">
            <div>
                You've hit the end! Check out these other nearby cafeterias:
            </div>
            <div className="flex flex-wrap">
                {
                    cafesToShow.map(cafe => (
                        <Link key={cafe.id} to={`/menu/${cafe.id}`} className="chip default-button default-container">
                            {cafe.name}
                        </Link>
                    ))
                }
            </div>
        </div>
    );
}