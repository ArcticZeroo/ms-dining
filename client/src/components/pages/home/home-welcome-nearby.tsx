import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { PassiveUserLocationNotifier } from '../../../api/location/user-location.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useViewsSortedByDistance } from '../../../hooks/cafe.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { LocationAllowButton } from '../../button/location-allow-button.tsx';

const NEARBY_CAFE_LIMIT = 3;

export const HomeWelcomeNearby = () => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const userLocation = useValueNotifier(PassiveUserLocationNotifier);

    const nearbyViews = useViewsSortedByDistance(userLocation);

    const nearbyViewsToShow = nearbyViews.slice(0, NEARBY_CAFE_LIMIT);

    const onAddAllToHomeClicked = () => {
        ApplicationSettings.homepageViews.add(...nearbyViewsToShow.map(view => view.value.id));
    }

    return (
        <div className="flex-col flex-justify-center">
            <LocationAllowButton reason={'for nearby cafe recommendations'}/>
            {
                nearbyViewsToShow.length > 0 && (
                    <div>
                        <div>
                            Nearby cafeterias:
                        </div>
                        <div className="flex flex-wrap">
                            {
                                nearbyViewsToShow.slice(0, NEARBY_CAFE_LIMIT).map(view => (
                                    <Link key={view.value.id} to={getViewMenuUrl({ view, viewsById, shouldUseGroups })} className="chip">
                                        {view.value.name}
                                    </Link>
                                ))
                            }
                        </div>
                        <button className="default-container flex flex-justify-center" onClick={onAddAllToHomeClicked}>
                            Add All To Home
                        </button>
                    </div>
                )
            }
        </div>
    );
}