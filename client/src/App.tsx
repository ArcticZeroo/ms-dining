import { useEffect, useRef, useState } from 'react';
import { Outlet, useLoaderData } from 'react-router-dom';
import { DiningClient } from './api/dining.ts';
import { ApplicationSettings } from './api/settings.ts';
import { Nav } from './components/nav/nav.tsx';
import { ApplicationContext } from './context/app.ts';
import { SelectedViewContext } from './context/view.ts';
import { NavExpansionContext } from './context/nav.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { useViewDataFromResponse } from './hooks/views';
import { CafeView, IViewListResponse } from './models/cafe.ts';
import { ICancellationToken } from './util/async';
import { classNames } from './util/react';
import { useValueNotifier } from './hooks/events.ts';

function App() {
    const { cafes, groups } = useLoaderData() as IViewListResponse;

    // TODO: Consider the possibility of filtering viewsById based on useGroups to avoid calls to isViewVisible
    const { viewsById, viewsInOrder } = useViewDataFromResponse(cafes, groups);
    const retrieveCafeMenusCancellationToken = useRef<ICancellationToken | undefined>(undefined);

    const requestMenusInBackground = useValueNotifier(ApplicationSettings.requestMenusInBackground);

    const [selectedView, setSelectedView] = useState<CafeView>();
    const menuDivRef = useRef<HTMLDivElement>(null);

    const [isNavExpanded, setIsNavExpanded] = useState(false);
    const deviceType = useDeviceType();

    const isNavVisible = deviceType === DeviceType.Desktop || isNavExpanded;
    const shouldStopScroll = isNavExpanded && deviceType === DeviceType.Mobile;

    useEffect(() => {
        if (menuDivRef.current) {
            menuDivRef.current.scrollTop = 0;
        }
    }, [selectedView]);

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

        DiningClient.retrieveAllMenusInOrder(cafes, viewsById, cancellationToken)
            .then(() => console.log('Retrieved all cafe menus!'))
            .catch(err => console.error('Failed to retrieve all cafe menus:', err));
    }, [cafes, viewsById, requestMenusInBackground]);

    return (
        <div className="App">
            <ApplicationContext.Provider value={{ viewsById, viewsInOrder, cafes, groups }}>
                <NavExpansionContext.Provider value={[isNavVisible, setIsNavExpanded]}>
                    <SelectedViewContext.Provider value={[selectedView, setSelectedView]}>
                        <Nav/>
                        <div className={classNames('content', shouldStopScroll && 'noscroll')} ref={menuDivRef}>
                            {
                                viewsById.size > 0 && (
                                    <Outlet/>
                                )
                            }
                            {
                                cafes.length === 0 && (
                                    <div className="error-card">
                                        There are no views available!
                                    </div>
                                )
                            }
                        </div>
                    </SelectedViewContext.Provider>
                </NavExpansionContext.Provider>
            </ApplicationContext.Provider>
        </div>
    );
}

export default App;
