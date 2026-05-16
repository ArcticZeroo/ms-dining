import React, { useEffect, useMemo } from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CafeCollapseContext, StationCollapseContext } from '../../context/collapse.ts';
import { useAutoAdvanceSelectedDate } from '../../hooks/date-picker.tsx';
import { useValueNotifier } from '../../hooks/events.ts';
import { resetSelectedDateToToday } from '../../store/zustand/selected-date.ts';
import { ValueNotifierSet } from '../../util/events.ts';
import { CafesOnPageContext } from '../../context/cafes-on-page.ts';
import { CafesOnPageNotifier } from '../../util/cafes-on-page.ts';

interface IStaticContextProvidersProps {
    children: React.ReactNode;
}

export const StaticContextProviders: React.FC<IStaticContextProvidersProps> = ({ children }) => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);

    const cafeCollapseNotifier = useMemo(() => new ValueNotifierSet<string>(new Set()), []);
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
        <CafeCollapseContext.Provider value={cafeCollapseNotifier}>
            <StationCollapseContext.Provider value={stationCollapseNotifier}>
                <CafesOnPageContext.Provider value={cafesOnPageNotifier}>
                    {children}
                </CafesOnPageContext.Provider>
            </StationCollapseContext.Provider>
        </CafeCollapseContext.Provider>
    );
}