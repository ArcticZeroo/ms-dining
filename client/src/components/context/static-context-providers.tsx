import React, { useMemo } from 'react';
import { ValueNotifier } from '../../util/events.ts';
import { DiningClient } from '../../api/dining.ts';
import { IModalContext, ModalContext } from '../../context/modal.ts';
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
    const modalNotifier = useMemo(() => new ValueNotifier<IModalContext | null>(null), []);
    const cartItemNotifier = useMemo(() => new ValueNotifier<Array<ICartItemWithMetadata>>([]), []);

    return (
        <SelectedDateContext.Provider value={selectedDateNotifier}>
            <SearchQueryContext.Provider value={searchQueryNotifier}>
                <ModalContext.Provider value={modalNotifier}>
                    <CartContext.Provider value={cartItemNotifier}>
                        {children}
                    </CartContext.Provider>
                </ModalContext.Provider>
            </SearchQueryContext.Provider>
        </SelectedDateContext.Provider>
    );
}