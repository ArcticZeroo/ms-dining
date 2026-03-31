import React, { useCallback, useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { toDateString } from '@msdining/common/util/date-util';
import { IRecommendationItem } from '@msdining/common/models/recommendation';
import { DiningClient } from '../../../api/client/dining.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { MapSelectedViewContext } from '../../../context/map.ts';
import { SelectedDateContext } from '../../../context/time.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { useNearestCafes } from '../../../hooks/nearby-cafes.ts';
import { useIsWideDesktop } from '../../../hooks/media-query.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { getViewLocation } from '../../../util/view.ts';
import { FavoriteItemButton } from '../../button/favorite/favorite-item-button.tsx';
import { MapCafeViewDetails } from '../../map/popup/map-cafe-view-details.tsx';
import { MapSidePanelContainer } from './map-side-panel-container.tsx';
import { MapOverviewFeaturedPanel } from './map-overview-featured-panel.tsx';
import { NearbyCafesList } from './nearby-cafes-list.tsx';

const useViewOverview = (viewId: string) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const selectedDateString = useMemo(() => toDateString(selectedDate), [selectedDate]);
    const retrieve = useCallback(
        () => DiningClient.retrieveOverview(viewId, selectedDateString),
        [viewId, selectedDateString]
    );
    return useImmediatePromiseState(retrieve);
};

interface IMapSidePanelOverviewProps {
    view: CafeView;
}

export const MapSidePanelOverview: React.FC<IMapSidePanelOverviewProps> = ({ view }) => {
    const navigate = useNavigate();
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const isWideDesktop = useIsWideDesktop();

    const viewLocation = useMemo(() => {
        try {
            return getViewLocation(view);
        } catch {
            return undefined;
        }
    }, [view]);

    const nearestCafes = useNearestCafes(
        viewLocation ?? { lat: 0, long: 0 },
        view.value.id
    );

    const viewName = getViewName({ view: view, showGroupName: true, includeEmoji: true });

    const { value: overviewResponse } = useViewOverview(view.value.id);

    const featuredItems: IRecommendationItem[] = overviewResponse?.featuredItems || [];
    const showDockedPanel = isWideDesktop && featuredItems.length > 0;

    return (
        <MapSelectedViewContext.Provider value={view}>
            <MapSidePanelContainer>
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
                        <MapCafeViewDetails
                            view={view}
                            showAllStations
                        />
                    </div>
                    {!showDockedPanel && featuredItems.length > 0 && (
                        <MapOverviewFeaturedPanel featuredItems={featuredItems}/>
                    )}
                    {viewLocation && (
                        <NearbyCafesList nearestCafes={nearestCafes}/>
                    )}
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
            </MapSidePanelContainer>
            {showDockedPanel && (
                <MapOverviewFeaturedPanel featuredItems={featuredItems} isDocked/>
            )}
        </MapSelectedViewContext.Provider>
    );
};
