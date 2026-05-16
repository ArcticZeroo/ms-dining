import React, { useEffect } from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useAutoAdvanceSelectedDate } from '../../hooks/date-picker.tsx';
import { useValueNotifier } from '../../hooks/events.ts';
import { resetSelectedDateToToday } from '../../store/zustand/selected-date.ts';

interface IStaticContextProvidersProps {
    children: React.ReactNode;
}

export const StaticContextProviders: React.FC<IStaticContextProvidersProps> = ({ children }) => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);

    // If the user toggles "allow future menus" off, snap any future selection
    // back to today so the menu views stop trying to load a future date.
    useEffect(() => {
        if (!allowFutureMenus) {
            resetSelectedDateToToday();
        }
    }, [allowFutureMenus]);

    useAutoAdvanceSelectedDate();

    return <>{children}</>;
}