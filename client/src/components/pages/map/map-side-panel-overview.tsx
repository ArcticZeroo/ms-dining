import React, { JSX, useCallback, useContext, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { toDateString } from '@msdining/common/util/date-util';
import { DiningClient } from '../../../api/client/dining.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { MapSelectedViewContext } from '../../../context/map.ts';
import { SelectedDateContext } from '../../../context/time.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { useNearestCafes } from '../../../hooks/nearby-cafes.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { getViewLocation } from '../../../util/view.ts';
import { FavoriteItemButton } from '../../button/favorite/favorite-item-button.tsx';
import { RecommendationSearchResult } from '../home/recommendations/recommendation-search-result.js';
import { MapCafeViewDetails } from '../../map/popup/map-cafe-view-details.tsx';
import { MapSidePanelContainer } from './map-side-panel-container.tsx';
import { NearbyCafesList } from './nearby-cafes-list.tsx';
import { ITabOption, TabView } from '../../view/tab-view.tsx';

const TAB_ID_OVERVIEW = 'overview';
const TAB_ID_FEATURED = 'featured';
const TAB_ID_NEARBY = 'nearby';

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
    const featuredItems = overviewResponse?.featuredItems ?? [];

    const tabOptions = useMemo(() => {
        const tabs: ITabOption[] = [
            { id: TAB_ID_OVERVIEW, name: 'Menu Overview' }
        ];

        if (featuredItems.length > 0) {
            tabs.push({ id: TAB_ID_FEATURED, name: 'Featured' });
        }

        if (viewLocation && nearestCafes.length > 0) {
            tabs.push({ id: TAB_ID_NEARBY, name: 'Nearby' });
        }

        return tabs;
    }, [featuredItems.length, viewLocation, nearestCafes.length]);

    const [selectedTabId, setSelectedTabId] = useState(TAB_ID_OVERVIEW);

    // If the selected tab gets removed (e.g. data changes), fall back to overview
    const effectiveTabId = tabOptions.some(t => t.id === selectedTabId) ? selectedTabId : TAB_ID_OVERVIEW;

    const renderTab = useCallback((tabId: string): JSX.Element => {
        switch (tabId) {
            case TAB_ID_FEATURED:
                return (
                    <div className="flex-col">
                        {featuredItems.map(item => (
                            <RecommendationSearchResult key={item.menuItemId} item={item}/>
                        ))}
                    </div>
                );
            case TAB_ID_NEARBY:
                return <NearbyCafesList nearestCafes={nearestCafes}/>;
            case TAB_ID_OVERVIEW:
            default:
                return (
                    <MapCafeViewDetails
                        view={view}
                        showAllStations
                    />
                );
        }
    }, [view, featuredItems, nearestCafes]);

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
                    <TabView
                        options={tabOptions}
                        selectedTabId={effectiveTabId}
                        onTabIdChanged={setSelectedTabId}
                        renderTab={renderTab}
                        enableSwipe
                    />
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
        </MapSelectedViewContext.Provider>
    );
};
