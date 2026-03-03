import React, { useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { MapSelectedViewContext } from '../../../context/map.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { getAllSingleCafesInView } from '../../../util/view.ts';
import { FavoriteItemButton } from '../../button/favorite/favorite-item-button.tsx';
import { CampusMapViewDetailsMember } from '../../map/popup/campus-map-view-details-member.tsx';

interface IMapSidePanelOverviewProps {
    view: CafeView;
}

export const MapSidePanelOverview: React.FC<IMapSidePanelOverviewProps> = ({ view }) => {
    const navigate = useNavigate();
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const cafesInView = useMemo(
        () => getAllSingleCafesInView(view, viewsById),
        [view, viewsById]
    );

    const viewName = getViewName({ view: view, showGroupName: true, includeEmoji: true });

    return (
        <MapSelectedViewContext.Provider value={view}>
            <div className="map-side-panel flex-col">
                <div className="panel-header flex">
                    <FavoriteItemButton
                        setting={ApplicationSettings.homepageViews}
                        name={view.value.id}
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
                {(shouldUseGroups || view.type === CafeViewType.single) && (
                    <div className="panel-footer flex">
                        <Link
                            to={getViewMenuUrl({ view: view, viewsById, shouldUseGroups })}
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
