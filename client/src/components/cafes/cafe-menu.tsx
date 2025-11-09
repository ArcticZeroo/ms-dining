import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CafeCollapseContext } from '../../context/collapse.ts';
import { CafeHeaderHeightContext } from '../../context/html.ts';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { useValueNotifier, useValueNotifierSetTarget } from '../../hooks/events.ts';
import { useElementHeight, useScrollCollapsedHeaderIntoView } from '../../hooks/html.ts';
import { ICafe } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { classNames } from '../../util/react.ts';
import { ScrollAnchor } from '../button/scroll-anchor.tsx';
import { ExpandIcon } from '../icon/expand.tsx';
import { CafeMenuBody } from './cafe-menu-body.tsx';
import { useTrackThisCafeOnPage } from '../../hooks/cafes-on-page.ts';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { DeviceType, useDeviceType } from '../../hooks/media-query.js';
import { usePopupOpener } from '../../hooks/popup.js';
import { CafePopupOverview } from '../map/popup/overview/cafe-popup-overview.js';
import { Modal } from '../popup/modal.js';

const menuOverviewSymbol = Symbol();

const useCafeName = (cafe: ICafe, showGroupName: boolean) => {
    return useMemo(() => getCafeName({ cafe, showGroupName }), [cafe, showGroupName]);
};

interface ICollapsibleCafeMenuProps {
	cafe: ICafe;
	showGroupName: boolean;
	shouldCountTowardsLastUsed: boolean;
}

export const CafeMenu: React.FC<ICollapsibleCafeMenuProps> = (
    {
        cafe,
        showGroupName,
        shouldCountTowardsLastUsed,
    }) => {
    useTrackThisCafeOnPage(cafe.id);

    const openPopup = usePopupOpener();
    const deviceType = useDeviceType();
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const collapsedCafeIdsNotifier = useContext(CafeCollapseContext);
    const [cafeHeaderElement, setCafeHeaderElement] = useState<HTMLDivElement | null>(null);
    const cafeHeaderHeight = useElementHeight(cafeHeaderElement);
    const buttonContainer = useRef<HTMLDivElement>(null);

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

    const toggleIsExpanded = (event: React.MouseEvent) => {
        // Click originated from button container; don't toggle collapse
        if (buttonContainer.current?.contains(event.target as Node)) {
            event.preventDefault();
            return;
        }

        const isNowCollapsed = !isCollapsed;

        if (isNowCollapsed) {
            collapsedCafeIdsNotifier.add(cafe.id);
            scrollIntoViewIfNeeded();
        } else {
            collapsedCafeIdsNotifier.delete(cafe.id);
        }
    };

    const onOpenMenuOverviewClicked = () => {
        openPopup({
            id: menuOverviewSymbol,
            body: (
                <Modal
                    title="Menu Overview"
                    body={
                        <CafePopupOverview
                            cafe={cafe}
                            showMessageForNoStations={true}
                        />
                    }
                />
            )
        });
    }

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
                                <span className="corner logo-container">
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
                                <span className="corner recently-opened">
                                    {
                                        /*openedRecently &&*/ <span className="default-container recently-opened-notice">New!</span>
                                    }
                                </span>
                            </div>
                            {
                                !isCollapsed && (
                                    <div
                                        className="flex flex-around flex-wrap force-base-font-size cafe-header-controls bg-raised-2"
                                        ref={buttonContainer}
                                    >
                                        <a
                                            className="default-button default-container flex"
                                            href={cafe.url || `https://${cafe.id}.buy-ondemand.com`}
                                            target="_blank"
                                            title="Click to open online ordering menu at buy-ondemand.com"
                                        >
                                            <span className="material-symbols-outlined">
                                                captive_portal
                                            </span>
                                            <span>
                                                Order{deviceType === DeviceType.Desktop && ' Online'}
                                            </span>
                                        </a>
                                        <button
                                            className="default-button default-container flex"
                                            title="Click to view menu overview"
                                            onClick={onOpenMenuOverviewClicked}
                                        >
                                            <span className="material-symbols-outlined">
                                                menu_book_2
                                            </span>
                                            <span>
                                                {deviceType === DeviceType.Desktop && 'Menu '}Overview
                                            </span>
                                        </button>
                                    </div>
                                )
                            }
                        </div>
                        <CafeMenuBody
                            isExpanded={!isCollapsed}
                            shouldCountTowardsLastUsed={shouldCountTowardsLastUsed}
                        />
                    </div>
                </div>
            </CafeHeaderHeightContext.Provider>
        </CurrentCafeContext.Provider>
    );
};