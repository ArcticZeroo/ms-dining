import React, { useEffect, useMemo } from 'react';
import { ValueNotifier } from '../../util/events.ts';
import { DiningClient } from '../../api/dining.ts';
import { SearchQueryContext } from '../../context/search.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { CartContext, CartItemsByCafeId } from '../../context/cart.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ApplicationSettings } from '../../api/settings.ts';
import { getInitialDateFromUrl } from '../../util/url.ts';

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

    useEffect(() => {
        if (!allowFutureMenus) {
            selectedDateNotifier.value = DiningClient.getTodayDateForMenu();
        }
    }, [selectedDateNotifier, allowFutureMenus]);

    return (
        <SelectedDateContext.Provider value={selectedDateNotifier}>
            <SearchQueryContext.Provider value={searchQueryNotifier}>
                <CartContext.Provider value={cartItemNotifier}>
                    {children}
                </CartContext.Provider>
            </SearchQueryContext.Provider>
        </SelectedDateContext.Provider>
    );
}