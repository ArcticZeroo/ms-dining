import React, { useEffect, useMemo } from 'react';
import { DiningClient } from '../../api/dining.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CartContext, CartHydrationContext, CartItemsByCafeId } from '../../context/cart.ts';
import { CafeCollapseContext, StationCollapseContext } from '../../context/collapse.ts';
import { CardNumberContext } from '../../context/payment.ts';
import { SearchQueryContext } from '../../context/search.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useCartHydration } from '../../hooks/cart.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ValueNotifier, ValueNotifierSet } from '../../util/events.ts';
import { getInitialDateFromUrl } from '../../util/url.ts';
import { CafesOnPageContext } from '../../context/cafes-on-page.ts';
import { CafesOnPageNotifier } from '../../util/cafes-on-page.ts';

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
    const cardNumberNotifier = useMemo(() => new ValueNotifier<string>(''), []);
    const stationCollapseNotifier = useMemo(() => new ValueNotifierSet<string>(new Set()), []);
    const cafesOnPageNotifier = useMemo(() => new CafesOnPageNotifier(), []);
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
                                <CardNumberContext.Provider value={cardNumberNotifier}>
                                    <CafesOnPageContext.Provider value={cafesOnPageNotifier}>
                                        {children}
                                    </CafesOnPageContext.Provider>
                                </CardNumberContext.Provider>
                            </StationCollapseContext.Provider>
                        </CafeCollapseContext.Provider>
                    </CartHydrationContext.Provider>
                </CartContext.Provider>
            </SearchQueryContext.Provider>
        </SelectedDateContext.Provider>
    );
}