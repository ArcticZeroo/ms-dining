import { useContext, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { MapSelectedViewContext } from '../../../context/map.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeViewType } from '../../../models/cafe.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { expandAndFlattenView } from '../../../util/view.ts';
import { FavoriteItemButton } from '../../button/favorite/favorite-item-button.tsx';
import { CampusMapViewDetailsMember } from '../../map/popup/campus-map-view-details-member.tsx';

export const MapSidePanelOverview = () => {
    const { viewId } = useParams<{ viewId: string }>();
    const navigate = useNavigate();
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const selectedView = viewId != null ? viewsById.get(viewId) : undefined;

    const cafesInView = useMemo(
        () => selectedView != null ? expandAndFlattenView(selectedView, viewsById) : [],
        [selectedView, viewsById]
    );

    if (!selectedView) {
        return null;
    }

    const viewName = getViewName({ view: selectedView, showGroupName: true, includeEmoji: true });

    return (
        <MapSelectedViewContext.Provider value={selectedView}>
            <div className="map-side-panel flex-col">
                <div className="panel-header flex">
                    <FavoriteItemButton
                        setting={ApplicationSettings.homepageViews}
                        name={selectedView.value.id}
                    />
                    <span className="panel-title">{viewName}</span>
                    <button
                        onClick={() => navigate('/map')}
                        className="default-button default-container icon-container"
                        title="Close"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="panel-content flex-col">
                    <div className="cafe-members-list flex-col">
                        {cafesInView.map(cafe => (
                            <CampusMapViewDetailsMember
                                key={cafe.id}
                                cafe={cafe}
                                showAllStations
                            />
                        ))}
                    </div>
                </div>
                {(shouldUseGroups || selectedView.type === CafeViewType.single) && (
                    <div className="panel-footer flex">
                        <Link
                            to={getViewMenuUrl({ view: selectedView, viewsById, shouldUseGroups })}
                            className="default-button default-container text-center"
                        >
                            View Full Menu
                        </Link>
                    </div>
                )}
            </div>
        </MapSelectedViewContext.Provider>
    );
};
