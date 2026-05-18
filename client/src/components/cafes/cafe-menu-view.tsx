import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../api/client/dining.ts';
import { ApplicationSettings, DebugSettings } from '../../constants/settings.ts';
import { CafeHeaderHeightContext } from '../../context/html.ts';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { useElementHeight, useScrollCollapsedHeaderIntoView } from '../../hooks/html.ts';
import { CafeMenu, ICafe } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { classNames } from '../../util/react.ts';
import { ScrollAnchor } from '../button/scroll-anchor.tsx';
import { ExpandIcon } from '../icon/expand.tsx';
import { CafeMenuBody } from './cafe-menu-body.tsx';
import { useTrackThisCafeOnPage } from '../../hooks/cafes-on-page.ts';
import { getIsRecentlyAvailable, minutesToTimeString } from '@msdining/common/util/date-util';
import { useSelectedDate } from '../../store/zustand/selected-date.ts';
import { collapseCafe, expandCafe, useIsCafeCollapsed } from '../../store/zustand/collapse.ts';
import { useCafeMenuQuery } from '../../store/queries/cafe.ts';
import { CafeMenuControls } from './cafe-menu-controls.js';
import { DeviceType, useDeviceType } from '../../hooks/media-query.js';

const useCafeName = (cafe: ICafe, showGroupName: boolean) => {
    return useMemo(() => getCafeName({ cafe, showGroupName }), [cafe, showGroupName]);
};

/**
 * Minimal view passed down to body/controls so they can consume the cafe menu
 * without knowing whether it's backed by TanStack Query or anything else.
 */
export interface ICafeMenuView {
    data: CafeMenu | undefined;
    isError: boolean;
    refetch: () => void;
}

const useCafeMenu = (cafe: ICafe, shouldCountTowardsLastUsed: boolean): ICafeMenuView => {
    const selectedDate = useSelectedDate();
    const query = useCafeMenuQuery(cafe.id, selectedDate);

    // Tracked outside the queryFn so the side effect isn't baked into the
    // query key — the boot-time warm-up and a real component render share one
    // cache entry instead of two. Gated on isSuccess so we don't add invalid
    // cafe ids to the recently-used list when a cafe route fails to load.
    useEffect(() => {
        if (shouldCountTowardsLastUsed && query.isSuccess) {
            DiningClient.addToLastUsedCafeIds(cafe.id);
        }
    }, [shouldCountTowardsLastUsed, query.isSuccess, cafe.id]);

    return {
        data:    query.data,
        isError: query.isError,
        refetch: () => {
            void query.refetch();
        },
    };
};

const useCafeHoursString = (menuData: ICafeMenuView): string | undefined => {
    return useMemo(() => {
        const stations = menuData.data?.stations;
        if (!stations || stations.length === 0) {
            return undefined;
        }

        let minOpensAt = Infinity;
        let maxClosesAt = -Infinity;
        for (const station of stations) {
            minOpensAt = Math.min(minOpensAt, station.opensAt);
            maxClosesAt = Math.max(maxClosesAt, station.closesAt);
        }

        if (!isFinite(minOpensAt) || !isFinite(maxClosesAt)) {
            console.error('Unexpected Infinity for opensAt/closesAt', stations);
            return undefined;
        }

        return `${minutesToTimeString(minOpensAt)} – ${minutesToTimeString(maxClosesAt)}`;
    }, [menuData.data]);
}

interface ICafeMenuViewProps {
	cafe: ICafe;
	showGroupName: boolean;
	shouldCountTowardsLastUsed: boolean;
}

export const CafeMenuView: React.FC<ICafeMenuViewProps> = (
    {
        cafe,
        showGroupName,
        shouldCountTowardsLastUsed,
    }) => {
    useTrackThisCafeOnPage(cafe.id);

    const deviceType = useDeviceType();
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const showCafeHours = useValueNotifier(DebugSettings.showCafeHours);
    const [cafeHeaderElement, setCafeHeaderElement] = useState<HTMLDivElement | null>(null);
    const cafeHeaderHeight = useElementHeight(cafeHeaderElement);
    const menuData = useCafeMenu(cafe, shouldCountTowardsLastUsed);
    const cafeHoursString = useCafeHoursString(menuData);

    const showCafeLogo = showImages && cafe.logoUrl != null;
    const cafeName = useCafeName(cafe, showGroupName);

    const isCollapsed = useIsCafeCollapsed(cafe.id);

    const scrollIntoViewIfNeeded = useScrollCollapsedHeaderIntoView(cafe.id);

    const openedRecently = useMemo(
        () => getIsRecentlyAvailable(cafe.firstAvailableDate),
        [cafe]
    );

    useEffect(() => {
        if (ApplicationSettings.collapseCafesByDefault.value) {
            collapseCafe(cafe.id);
        }
    }, [cafe.id]);

    const toggleIsExpanded = useCallback(() => {
        const isNowCollapsed = !isCollapsed;

        if (isNowCollapsed) {
            collapseCafe(cafe.id);
            scrollIntoViewIfNeeded();
        } else {
            expandCafe(cafe.id);
        }
    }, [isCollapsed, cafe.id, scrollIntoViewIfNeeded]);

    return (
        <CurrentCafeContext.Provider value={cafe}>
            <CafeHeaderHeightContext.Provider value={cafeHeaderHeight}>
                {/*Container to allow gap per-cafe since we have the scroll anchor at the top*/}
                <div>
                    <ScrollAnchor id={cafe.id}/>
                    <div
                        className={classNames(
                            'collapsible-content collapsible-cafe',
                            isCollapsed && 'collapsed',
                            !isCollapsed && 'expanded',
                            openedRecently && 'recently-opened'
                        )}
                        key={cafe.id}
                    >
                        <div className="cafe-header" ref={setCafeHeaderElement}>
                            <div role="button" className="collapse-toggle" onClick={toggleIsExpanded}>
                                <span className="grid-justify-start">
                                    {
                                        showCafeLogo && (
                                            <img src={cafe.logoUrl}
                                                alt={`${cafe.name} logo`}
                                                className="logo"
                                            />
                                        )
                                    }
                                </span>
                                <div className="flex-col constant-gap">
                                    <span className="cafe-name">
                                        {cafeName}
                                        <ExpandIcon isExpanded={!isCollapsed}/>
                                    </span>
                                    {
                                        showCafeHours && cafeHoursString && (
                                            <span className="cafe-hours">{cafeHoursString}</span>
                                        )
                                    }
                                </div>
                                <span className="flex grid-justify-end">
                                    {
                                        deviceType === DeviceType.Desktop && (
                                            <CafeMenuControls
                                                cafeName={cafeName}
                                                menuData={menuData}
                                            />
                                        )
                                    }
                                    {
                                        openedRecently && <span className="default-container recently-opened-notice">New!</span>
                                    }
                                </span>
                            </div>
                            {
                                deviceType === DeviceType.Mobile && !isCollapsed && (
                                    <CafeMenuControls
                                        cafeName={cafeName}
                                        menuData={menuData}
                                    />
                                )
                            }
                        </div>
                        <CafeMenuBody
                            isExpanded={!isCollapsed}
                            menuData={menuData}
                        />
                    </div>
                </div>
            </CafeHeaderHeightContext.Provider>
        </CurrentCafeContext.Provider>
    );
};