import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import { DiningClient } from './api/dining.ts';
import { ApplicationContext } from './context/app.ts';
import { SelectedViewContext } from './context/view.ts';
import { NavExpansionContext } from './context/nav.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { useViewDataFromResponse } from './hooks/views';
import { CafeView, ICafeGroup, IViewListResponse } from './models/cafe.ts';
import { ICancellationToken } from './util/async';
import { ValueNotifier } from './util/events.ts';
import { StaticContextProviders } from './components/context/static-context-providers.tsx';
import { Root } from './Root.tsx';

const useBackgroundMenuUpdate = (viewsById: Map<string, CafeView>, groups: ICafeGroup[]) => {
    const retrieveCafeMenusCancellationToken = useRef<ICancellationToken | undefined>(undefined);

    useEffect(() => {
        if (cafes.length === 0 || viewsById.size === 0) {
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
    }, [cafes, viewsById]);
};

const App = () => {
    const { groups } = useLoaderData() as IViewListResponse;

    // TODO: Consider the possibility of filtering viewsById based on useGroups to avoid calls to isViewVisible
    const { viewsById, viewsInOrder } = useViewDataFromResponse(groups);

    useBackgroundMenuUpdate(viewsById);

    const selectedViewNotifier = useMemo(
        () => new ValueNotifier<CafeView | undefined>(undefined),
        []
    );

    const [isNavExpanded, setIsNavExpanded] = useState(false);
    const deviceType = useDeviceType();
    const isNavVisible = deviceType === DeviceType.Desktop || isNavExpanded;

    const applicationContext = useMemo(
        () => ({
            viewsById,
            viewsInOrder,
            groups
        }),
        [viewsById, viewsInOrder, groups]
    );

    const navExpansionContext = useMemo(
        () => [isNavVisible, setIsNavExpanded] as const,
        [isNavVisible]
    );

    return (
        <div className="App">
            <ApplicationContext.Provider value={applicationContext}>
                <NavExpansionContext.Provider value={navExpansionContext}>
                    <SelectedViewContext.Provider value={selectedViewNotifier}>
                        <StaticContextProviders>
                            <Root/>
                        </StaticContextProviders>
                    </SelectedViewContext.Provider>
                </NavExpansionContext.Provider>
            </ApplicationContext.Provider>
        </div>
    );
};

export default App;
