import React, { useEffect, useMemo } from 'react';
import { ValueNotifier, ValueNotifierSet } from '../../util/events.ts';
import { DiningClient } from '../../api/dining.ts';
import { SearchQueryContext } from '../../context/search.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { CartContext, CartItemsByCafeId } from '../../context/cart.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { getInitialDateFromUrl } from '../../util/url.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CafeCollapseContext, StationCollapseContext } from '../../context/collapse.ts';

interface IStaticContextProvidersProps {
    children: React.ReactNode;
}

export const StaticContextProviders: React.FC<IStaticContextProvidersProps> = ({ children }) => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);

    const selectedDateNotifier = useMemo(
        () => new ValueNotifier<Date>(
            ApplicationSettings.allowFutureMenus.value
                ? getInitialDateFromUrl()
                : DiningClient.getTodayDateForMenu()
        ),
        []
    );

    const searchQueryNotifier = useMemo(() => new ValueNotifier<string>(''), []);
    const cartItemNotifier = useMemo(() => new ValueNotifier<CartItemsByCafeId>(new Map()), []);
    const cafeCollapseNotifier = useMemo(() => new ValueNotifierSet<string>(new Set()), []);
    const stationCollapseNotifier = useMemo(() => new ValueNotifierSet<string>(new Set()), []);

    useEffect(() => {
        if (!allowFutureMenus) {
            selectedDateNotifier.value = DiningClient.getTodayDateForMenu();
        }
    }, [selectedDateNotifier, allowFutureMenus]);

    return (
        <SelectedDateContext.Provider value={selectedDateNotifier}>
            <SearchQueryContext.Provider value={searchQueryNotifier}>
                <CartContext.Provider value={cartItemNotifier}>
                    <CafeCollapseContext.Provider value={cafeCollapseNotifier}>
                        <StationCollapseContext.Provider value={stationCollapseNotifier}>
                            {children}
                        </StationCollapseContext.Provider>
                    </CafeCollapseContext.Provider>
                </CartContext.Provider>
            </SearchQueryContext.Provider>
        </SelectedDateContext.Provider>
    );
}