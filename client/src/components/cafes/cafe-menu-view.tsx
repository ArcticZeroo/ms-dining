import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../api/client/dining.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CafeHeaderHeightContext } from '../../context/html.ts';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { useElementHeight, useScrollCollapsedHeaderIntoView } from '../../hooks/html.ts';
import { CafeMenu, ICafe } from '../../models/cafe.ts';
import { classNames } from '../../util/react.ts';
import { ScrollAnchor } from '../button/scroll-anchor.tsx';
import { CafeMenuBody } from './cafe-menu-body.tsx';
import { CafeMenuHeader } from './cafe-menu-header.tsx';
import { useTrackThisCafeOnPage } from '../../hooks/cafes-on-page.ts';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { useSelectedDate } from '../../store/zustand/selected-date.ts';
import { collapseCafe, expandCafe, useIsCafeCollapsed } from '../../store/zustand/collapse.ts';
import { useCafeMenuQuery } from '../../store/queries/cafe.ts';

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

    const [cafeHeaderElement, setCafeHeaderElement] = useState<HTMLDivElement | null>(null);
    const cafeHeaderHeight = useElementHeight(cafeHeaderElement);
    const menuData = useCafeMenu(cafe, shouldCountTowardsLastUsed);

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
                        <CafeMenuHeader
                            cafe={cafe}
                            showGroupName={showGroupName}
                            isCollapsed={isCollapsed}
                            openedRecently={openedRecently}
                            menuData={menuData}
                            onToggle={toggleIsExpanded}
                            headerRef={setCafeHeaderElement}
                        />
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