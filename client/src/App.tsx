import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLoaderData } from 'react-router-dom';
import { DiningClient } from './api/dining.ts';
import { ApplicationSettings } from './api/settings.ts';
import { Nav } from './components/nav/nav.tsx';
import { ApplicationContext } from './context/app.ts';
import { SearchQueryContext } from './context/search.ts';
import { SelectedViewContext } from './context/view.ts';
import { NavExpansionContext } from './context/nav.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { useViewDataFromResponse } from './hooks/views';
import { CafeView, ICafe, IViewListResponse } from './models/cafe.ts';
import { ICancellationToken } from './util/async';
import { classNames } from './util/react';
import { useValueNotifier } from './hooks/events.ts';
import { ValueNotifier } from './util/events.ts';
import { SelectedDateContext } from './context/time.ts';

const useBackgroundMenuUpdate = (viewsById: Map<string, CafeView>, cafes: ICafe[]) => {
    const requestMenusInBackground = useValueNotifier(ApplicationSettings.requestMenusInBackground);
    const retrieveCafeMenusCancellationToken = useRef<ICancellationToken | undefined>(undefined);

    useEffect(() => {
        if (!requestMenusInBackground || cafes.length === 0 || viewsById.size === 0) {
            return;
        }

        const lastCancellationToken = retrieveCafeMenusCancellationToken.current;
        if (lastCancellationToken) {
            lastCancellationToken.isCancelled = true;
        }

        const cancellationToken: ICancellationToken = { isCancelled: false };
        retrieveCafeMenusCancellationToken.current = cancellationToken;

        DiningClient.retrieveRecentMenusInOrder(cafes, viewsById, cancellationToken)
            .then(() => console.log('Retrieved recent cafe menus!'))
            .catch(err => console.error('Failed to retrieve recent cafe menus:', err));
    }, [cafes, viewsById, requestMenusInBackground]);
};

const useMenuScrollTopRef = (selectedViewNotifier: ValueNotifier<CafeView | undefined>) => {
    const selectedView = useValueNotifier(selectedViewNotifier);
    const menuDivRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (menuDivRef.current) {
            menuDivRef.current.scrollTop = 0;
        }
    }, [selectedView]);

    return menuDivRef;
};

const App = () => {
    const { cafes, groups } = useLoaderData() as IViewListResponse;

    // TODO: Consider the possibility of filtering viewsById based on useGroups to avoid calls to isViewVisible
    const { viewsById, viewsInOrder } = useViewDataFromResponse(cafes, groups);

    const selectedViewNotifier = useMemo(
        () => new ValueNotifier<CafeView | undefined>(undefined),
        []
    );

    const selectedDateNotifier = useMemo(
        () => new ValueNotifier<Date>(DiningClient.getTodayDateForMenu()),
        []
    );

    const searchQueryNotifier = useMemo(() => new ValueNotifier<string>(''), []);

    const [isNavExpanded, setIsNavExpanded] = useState(false);
    const deviceType = useDeviceType();

    const isNavVisible = deviceType === DeviceType.Desktop || isNavExpanded;
    const shouldStopScroll = isNavExpanded && deviceType === DeviceType.Mobile;

    const menuDivRef = useMenuScrollTopRef(selectedViewNotifier);
    useBackgroundMenuUpdate(viewsById, cafes);

    return (
        <div className="App">
            <ApplicationContext.Provider value={{ viewsById, viewsInOrder, cafes, groups }}>
                <NavExpansionContext.Provider value={[isNavVisible, setIsNavExpanded]}>
                    <SelectedViewContext.Provider value={selectedViewNotifier}>
                        <SelectedDateContext.Provider value={selectedDateNotifier}>
                            <SearchQueryContext.Provider value={searchQueryNotifier}>
                                <Nav/>
                                <div className={classNames('content', shouldStopScroll && 'noscroll')} ref={menuDivRef}>
                                    <Outlet/>
                                </div>
                            </SearchQueryContext.Provider>
                        </SelectedDateContext.Provider>
                    </SelectedViewContext.Provider>
                </NavExpansionContext.Provider>
            </ApplicationContext.Provider>
        </div>
    );
};

export default App;
