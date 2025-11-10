import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CafeCollapseContext } from '../../context/collapse.ts';
import { CafeHeaderHeightContext } from '../../context/html.ts';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { useValueNotifier, useValueNotifierContext, useValueNotifierSetTarget } from '../../hooks/events.ts';
import { useElementHeight, useScrollCollapsedHeaderIntoView } from '../../hooks/html.ts';
import { CafeMenu, ICafe } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { classNames } from '../../util/react.ts';
import { ScrollAnchor } from '../button/scroll-anchor.tsx';
import { ExpandIcon } from '../icon/expand.tsx';
import { CafeMenuBody } from './cafe-menu-body.tsx';
import { useTrackThisCafeOnPage } from '../../hooks/cafes-on-page.ts';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { IDelayedPromiseState, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { SelectedDateContext } from '../../context/time.js';
import { DiningClient } from '../../api/client/dining.js';
import { CafeMenuControls } from './cafe-menu-controls.js';
import { DeviceType, useDeviceType } from '../../hooks/media-query.js';

const useCafeName = (cafe: ICafe, showGroupName: boolean) => {
    return useMemo(() => getCafeName({ cafe, showGroupName }), [cafe, showGroupName]);
};

const useMenuData = (cafe: ICafe, shouldCountTowardsLastUsed: boolean): IDelayedPromiseState<CafeMenu> => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const retrieveMenu = useCallback(
        () => DiningClient.retrieveCafeMenu({
            id: cafe.id,
            date: selectedDate,
            shouldCountTowardsLastUsed
        }),
        [cafe, selectedDate, shouldCountTowardsLastUsed]
    );

    return useDelayedPromiseState(retrieveMenu);
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
    const collapsedCafeIdsNotifier = useContext(CafeCollapseContext);
    const [cafeHeaderElement, setCafeHeaderElement] = useState<HTMLDivElement | null>(null);
    const cafeHeaderHeight = useElementHeight(cafeHeaderElement);
    const menuData = useMenuData(cafe, shouldCountTowardsLastUsed);

    const showCafeLogo = showImages && cafe.logoUrl != null;
    const cafeName = useCafeName(cafe, showGroupName);

    const isCollapsed = useValueNotifierSetTarget(collapsedCafeIdsNotifier, cafe.id);

    const scrollIntoViewIfNeeded = useScrollCollapsedHeaderIntoView(cafe.id);

    const openedRecently = useMemo(
        () => getIsRecentlyAvailable(cafe.firstAvailableDate),
        [cafe]
    );

    useEffect(() => {
        if (ApplicationSettings.collapseCafesByDefault.value) {
            collapsedCafeIdsNotifier.add(cafe.id);
        }
    }, [collapsedCafeIdsNotifier, cafe.id]);

    const toggleIsExpanded = () => {
        const isNowCollapsed = !isCollapsed;

        if (isNowCollapsed) {
            collapsedCafeIdsNotifier.add(cafe.id);
            scrollIntoViewIfNeeded();
        } else {
            collapsedCafeIdsNotifier.delete(cafe.id);
        }
    };

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