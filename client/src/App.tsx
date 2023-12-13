import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLoaderData } from 'react-router-dom';
import { DiningClient } from './api/dining.ts';
import { Nav } from './components/nav/nav.tsx';
import { ApplicationContext } from './context/app.ts';
import { SelectedViewContext } from './context/view.ts';
import { NavExpansionContext } from './context/nav.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { useViewDataFromResponse } from './hooks/views';
import { CafeView, ICafe, IViewListResponse } from './models/cafe.ts';
import { ICancellationToken } from './util/async';
import { classNames } from './util/react';
import { useValueNotifier } from './hooks/events.ts';
import { ValueNotifier } from './util/events.ts';
import { Modal } from './components/popup/modal.tsx';
import { StaticContextProviders } from './components/context/static-context-providers.tsx';
import { CartPopup } from './components/dining-halls/station/menu-items/order/cart/cart-popup.tsx';

const useBackgroundMenuUpdate = (viewsById: Map<string, CafeView>, cafes: ICafe[]) => {
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

    useBackgroundMenuUpdate(viewsById, cafes);

    const selectedViewNotifier = useMemo(
        () => new ValueNotifier<CafeView | undefined>(undefined),
        []
    );

    const [isNavExpanded, setIsNavExpanded] = useState(false);
    const deviceType = useDeviceType();

    const isNavVisible = deviceType === DeviceType.Desktop || isNavExpanded;
    const shouldStopScroll = isNavExpanded && deviceType === DeviceType.Mobile;

    const menuDivRef = useMenuScrollTopRef(selectedViewNotifier);

    const applicationContext = useMemo(
        () => ({
            viewsById,
            viewsInOrder,
            cafes,
            groups
        }),
        [viewsById, viewsInOrder, cafes, groups]
    );

    const navExpansionContext = useMemo(
        () => [isNavVisible, (isExpanded: boolean) => setIsNavExpanded(isExpanded)] as const,
        [isNavVisible]
    );

    return (
        <div className="App">
            <ApplicationContext.Provider value={applicationContext}>
                <NavExpansionContext.Provider value={navExpansionContext}>
                    <SelectedViewContext.Provider value={selectedViewNotifier}>
                        <StaticContextProviders>
                            <Modal/>
                            <Nav/>
                            <div className={classNames('content', shouldStopScroll && 'noscroll')}
                                 ref={menuDivRef}>
                                <Outlet/>
                            </div>
                            <CartPopup/>
                        </StaticContextProviders>
                    </SelectedViewContext.Provider>
                </NavExpansionContext.Provider>
            </ApplicationContext.Provider>
        </div>
    );
};

export default App;
