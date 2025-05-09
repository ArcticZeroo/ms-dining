import { IDiningCoreResponse } from '@msdining/common/dist/models/http.ts';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DiningClient } from '../api/dining.ts';
import { StaticContextProviders } from './context/static-context-providers.tsx';
import { ApplicationContext } from '../context/app.ts';
import { NavExpansionContext } from '../context/nav.ts';
import { DeviceType, useDeviceType } from '../hooks/media-query.ts';
import { useViewDataFromResponse } from '../hooks/views.ts';
import { CafeView, ICafe } from '../models/cafe.ts';
import { PageLayout } from './pages/page-layout.tsx';
import { ICancellationToken } from '../util/async.ts';
import { useValueNotifier } from '../hooks/events.ts';
import { ApplicationSettings } from '../constants/settings.ts';
import { classNames } from '../util/react.ts';
import { UserIdContext } from '../context/auth.ts';
import { ValueNotifier } from '../util/events.ts';

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

interface IAppWithDataProps {
    response: IDiningCoreResponse;
}

const AppWithData: React.FC<IAppWithDataProps> = ({ response }) => {
    const { groups, isTrackingEnabled, user } = response;
    const userId = user?.id;

    // TODO: Consider the possibility of filtering viewsById based on useGroups to avoid calls to isViewVisible
    const { viewsById, viewsInOrder, cafes } = useViewDataFromResponse(groups);

    useBackgroundMenuUpdate(viewsById, cafes);

    const shouldUseCompactMode = useValueNotifier(ApplicationSettings.shouldUseCompactMode);
    const [isNavExpanded, setIsNavExpanded] = useState(false);
    const deviceType = useDeviceType();
    const isNavVisible = deviceType === DeviceType.Desktop || isNavExpanded;

    const applicationContext = useMemo(
        () => ({
            viewsById,
            viewsInOrder,
            cafes,
            groups,
            isTrackingEnabled,
        }),
        [viewsById, viewsInOrder, cafes, groups, isTrackingEnabled]
    );

    const navExpansionContext = useMemo(
        () => [isNavVisible, setIsNavExpanded] as const,
        [isNavVisible]
    );

    const userIdNotifier = useMemo(
        () => new ValueNotifier(userId),
        [userId]
    );

    return (
        <div className={classNames('App', shouldUseCompactMode && 'compact-view-mode')}>
            <ApplicationContext.Provider value={applicationContext}>
                <UserIdContext.Provider value={userIdNotifier}>
                    <NavExpansionContext.Provider value={navExpansionContext}>
                        <StaticContextProviders>
                            <PageLayout/>
                        </StaticContextProviders>
                    </NavExpansionContext.Provider>
                </UserIdContext.Provider>
            </ApplicationContext.Provider>
        </div>
    );
};

export default AppWithData;
