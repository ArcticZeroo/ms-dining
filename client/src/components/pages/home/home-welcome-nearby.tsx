import { useValueNotifier } from '../../../hooks/events.ts';
import { PassiveUserLocationNotifier, queryForLocationPermission } from '../../../api/location/user-location.ts';
import { useCafesSortedByDistance } from '../../../hooks/cafe.ts';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';

const NEARBY_CAFE_LIMIT = 3;

export const HomeWelcomeNearby = () => {
    const userLocation = useValueNotifier(PassiveUserLocationNotifier);

    const nearbyCafes = useCafesSortedByDistance(userLocation);

    const nearbyCafesToShow = nearbyCafes.slice(0, NEARBY_CAFE_LIMIT);

    const onAddAllToHomeClicked = () => {
        ApplicationSettings.homepageViews.add(...nearbyCafesToShow.map(cafe => cafe.id));
    }

    return (
        <div className="flex-col flex-center">
            {
                !userLocation && (
                    <button className="default-container flex flex-center" onClick={queryForLocationPermission}>
                        <span className="material-symbols-outlined">
                           location_on
                        </span>
                        Allow location permissions for nearby cafe recommendations
                    </button>
                )
            }
            {
                nearbyCafesToShow.length > 0 && (
                    <div>
                        <div>
                            Nearby cafeterias:
                        </div>
                        <div className="flex flex-wrap">
                            {
                                nearbyCafesToShow.slice(0, NEARBY_CAFE_LIMIT).map(cafe => (
                                    <Link key={cafe.id} to={`/menu/${cafe.id}`} className="chip">
                                        {cafe.name}
                                    </Link>
                                ))
                            }
                        </div>
                        <button className="default-container flex flex-center" onClick={onAddAllToHomeClicked}>
                            Add All To Home
                        </button>
                    </div>
                )
            }
        </div>
    );
}