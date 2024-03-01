import React, { useContext, useEffect, useMemo, useState } from 'react';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ICafe } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { classNames } from '../../util/react.ts';
import { ScrollAnchor } from '../button/scroll-anchor.tsx';
import { ExpandIcon } from '../icon/expand.tsx';
import { CollapsibleCafeMenuBody } from './collapsible-cafe-menu-body.tsx';
import { ApplicationSettings } from '../../constants/settings.ts';
import { CafeCollapseContext } from '../../context/collapse.ts';
import { CafeHeaderHeightContext } from '../../context/html.ts';
import { queryForScrollAnchor, scrollIntoViewIfNeeded } from '../../util/html.ts';

const useCafeName = (cafe: ICafe, showGroupName: boolean) => {
    return useMemo(() => getCafeName(cafe, showGroupName), [cafe, showGroupName]);
};

const useElementHeight = (headerElement: HTMLDivElement | null) => {
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (!headerElement) {
            setHeight(0);
            return;
        }

        const updateHeight = () => {
            setHeight(headerElement.clientHeight);
        }

        const observer = new ResizeObserver(updateHeight);
        observer.observe(headerElement);

        updateHeight();

        return () => observer.disconnect();
    }, [headerElement]);

    return height;
}

interface ICollapsibleCafeMenuProps {
    cafe: ICafe;
    showGroupName: boolean;
    shouldCountTowardsLastUsed: boolean;
}

export const CollapsibleCafeMenu: React.FC<ICollapsibleCafeMenuProps> = (
    {
        cafe,
        showGroupName,
        shouldCountTowardsLastUsed
    }) => {
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const collapsedCafeIdsNotifier = useContext(CafeCollapseContext);
    const collapsedCafeIds = useValueNotifier(collapsedCafeIdsNotifier);
    const [cafeHeaderElement, setCafeHeaderElement] = useState<HTMLDivElement | null>(null);
    const cafeHeaderHeight = useElementHeight(cafeHeaderElement);

    const showCafeLogo = showImages && cafe.logoUrl != null;
    const cafeName = useCafeName(cafe, showGroupName);

    const isExpanded = useMemo(
        () => !collapsedCafeIds.has(cafe.id),
        [collapsedCafeIds, cafe.id]
    );

    useEffect(() => {
        if (ApplicationSettings.collapseCafesByDefault.value) {
            collapsedCafeIdsNotifier.add(cafe.id);
        }
    }, [collapsedCafeIdsNotifier, cafe.id]);

    const toggleIsExpanded = () => {
        const isNowExpanded = !isExpanded;

        if (isNowExpanded) {
            collapsedCafeIdsNotifier.delete(cafe.id);
        } else {
            collapsedCafeIdsNotifier.add(cafe.id);
            scrollIntoViewIfNeeded(queryForScrollAnchor(cafe.id));
        }
    };

    return (
        <CurrentCafeContext.Provider value={cafe}>
            <CafeHeaderHeightContext.Provider value={cafeHeaderHeight}>
                <ScrollAnchor id={cafe.id}/>
                <div
                    className={classNames('collapsible-content collapsible-cafe', !isExpanded && 'collapsed')}
                    key={cafe.id}
                >
                    <div className="cafe-header" ref={setCafeHeaderElement}>
                        <div className="fixed-header-floating-block"/>
                        <a className="cafe-order-link"
                            href={cafe.url || `https://${cafe.id}.buy-ondemand.com`}
                            target="_blank">
                            <span className="material-symbols-outlined">
                                open_in_new
                            </span>
                        </a>
                        <button className="collapse-toggle cafe-name" onClick={toggleIsExpanded}>
                            {
                                showCafeLogo && (
                                    <img src={cafe.logoUrl}
                                        alt={`${cafe.name} logo`}
                                        className="logo"
                                    />
                                )
                            }
                            {cafeName}
                            <ExpandIcon isExpanded={isExpanded}/>
                        </button>
                    </div>
                    <CollapsibleCafeMenuBody
                        isExpanded={isExpanded}
                        shouldCountTowardsLastUsed={shouldCountTowardsLastUsed}
                    />
                </div>
            </CafeHeaderHeightContext.Provider>
        </CurrentCafeContext.Provider>
    );
};