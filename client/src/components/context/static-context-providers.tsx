import React, { useEffect, useMemo } from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CafeCollapseContext, StationCollapseContext } from '../../context/collapse.ts';
import { CardNumberContext } from '../../context/payment.ts';
import { SearchQueryContext } from '../../context/search.ts';
import { useAutoAdvanceSelectedDate } from '../../hooks/date-picker.tsx';
import { useValueNotifier } from '../../hooks/events.ts';
import { resetSelectedDateToToday } from '../../store/zustand/selected-date.ts';
import { ValueNotifier, ValueNotifierSet } from '../../util/events.ts';
import { CafesOnPageContext } from '../../context/cafes-on-page.ts';
import { CafesOnPageNotifier } from '../../util/cafes-on-page.ts';

interface IStaticContextProvidersProps {
    children: React.ReactNode;
}

export const StaticContextProviders: React.FC<IStaticContextProvidersProps> = ({ children }) => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);

    const searchQueryNotifier = useMemo(() => new ValueNotifier<string>(''), []);
    const cafeCollapseNotifier = useMemo(() => new ValueNotifierSet<string>(new Set()), []);
    const cardNumberNotifier = useMemo(() => new ValueNotifier<string>(''), []);
    const stationCollapseNotifier = useMemo(() => new ValueNotifierSet<string>(new Set()), []);
    const cafesOnPageNotifier = useMemo(() => new CafesOnPageNotifier(), []);

    // If the user toggles "allow future menus" off, snap any future selection
    // back to today so the menu views stop trying to load a future date.
    useEffect(() => {
        if (!allowFutureMenus) {
            resetSelectedDateToToday();
        }
    }, [allowFutureMenus]);

    useAutoAdvanceSelectedDate();

    return (
        <SearchQueryContext.Provider value={searchQueryNotifier}>
            <CafeCollapseContext.Provider value={cafeCollapseNotifier}>
                <StationCollapseContext.Provider value={stationCollapseNotifier}>
                    <CardNumberContext.Provider value={cardNumberNotifier}>
                        <CafesOnPageContext.Provider value={cafesOnPageNotifier}>
                            {children}
                        </CafesOnPageContext.Provider>
                    </CardNumberContext.Provider>
                </StationCollapseContext.Provider>
            </CafeCollapseContext.Provider>
        </SearchQueryContext.Provider>
    );
}