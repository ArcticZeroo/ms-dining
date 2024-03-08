import React, { useEffect, useMemo } from 'react';
import { ValueNotifier, ValueNotifierSet } from '../../util/events.ts';
import { DiningClient } from '../../api/dining.ts';
import { SearchQueryContext } from '../../context/search.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { CartContext, CartHydrationContext, CartItemsByCafeId } from '../../context/cart.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { getInitialDateFromUrl } from '../../util/url.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CafeCollapseContext, StationCollapseContext } from '../../context/collapse.ts';
import { useCartHydration } from '../../hooks/cart.ts';

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
    const cafeCollapseNotifier = useMemo(() => new ValueNotifierSet<string>(new Set()), []);
    const stationCollapseNotifier = useMemo(() => new ValueNotifierSet<string>(new Set()), []);

    const cartItemNotifier = useMemo(() => new ValueNotifier<CartItemsByCafeId>(new Map()), []);
    const cartHydrationNotifier = useCartHydration(cartItemNotifier);

    useEffect(() => {
        if (!allowFutureMenus) {
            selectedDateNotifier.value = DiningClient.getTodayDateForMenu();
        }
    }, [selectedDateNotifier, allowFutureMenus]);

    return (
        <SelectedDateContext.Provider value={selectedDateNotifier}>
            <SearchQueryContext.Provider value={searchQueryNotifier}>
                <CartContext.Provider value={cartItemNotifier}>
                    <CartHydrationContext.Provider value={cartHydrationNotifier}>
                        <CafeCollapseContext.Provider value={cafeCollapseNotifier}>
                            <StationCollapseContext.Provider value={stationCollapseNotifier}>
                                {children}
                            </StationCollapseContext.Provider>
                        </CafeCollapseContext.Provider>
                    </CartHydrationContext.Provider>
                </CartContext.Provider>
            </SearchQueryContext.Provider>
        </SelectedDateContext.Provider>
    );
}