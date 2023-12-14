import React, { useMemo } from 'react';
import { ValueNotifier } from '../../util/events.ts';
import { DiningClient } from '../../api/dining.ts';
import { SearchQueryContext } from '../../context/search.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { CartContext } from '../../context/cart.ts';
import { ICartItemWithMetadata } from '../../models/cart.ts';

interface IStaticContextProvidersProps {
    children: React.ReactNode;
}

export const StaticContextProviders: React.FC<IStaticContextProvidersProps> = ({ children }) => {

    const selectedDateNotifier = useMemo(
        () => new ValueNotifier<Date>(DiningClient.getTodayDateForMenu()),
        []
    );

    const searchQueryNotifier = useMemo(() => new ValueNotifier<string>(''), []);
    const cartItemNotifier = useMemo(() => new ValueNotifier<Array<ICartItemWithMetadata>>([]), []);

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