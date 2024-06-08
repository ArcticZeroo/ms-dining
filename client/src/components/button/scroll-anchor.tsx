import React, { useContext, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CafeCollapseContext, StationCollapseContext } from '../../context/collapse.ts';
import { CurrentCafeContext, CurrentStationContext } from '../../context/menu-item.ts';

const SCROLL_DELAY_MS = 50;

interface IScrollAnchorProps {
    id: string;
    margin?: string;
}

export const ScrollAnchor: React.FC<IScrollAnchorProps> = ({ id, margin }) => {
    const [element, setElement] = useState<HTMLAnchorElement | null>();
    const location = useLocation();

    const collapsedCafeIdsNotifier = useContext(CafeCollapseContext);
    const collapsedStationNamesNotifier = useContext(StationCollapseContext);
    const cafe = useContext(CurrentCafeContext);
    const stationId = useContext(CurrentStationContext);

    const anchorId = `#${id}`;

    useLayoutEffect(() => {
        if (element == null) {
            return;
        }

        if (location.hash !== anchorId) {
            return;
        }

        if (cafe.id !== '') {
            collapsedCafeIdsNotifier.delete(cafe.id);

            if (stationId.length > 0) {
                collapsedStationNamesNotifier.delete(stationId);
            }
        }

        // Jump to hash after render
        // Smooth seems to have problems with images loading as we scroll
        // We also have a short delay since sometimes the surrounding stuff hasn't finished rendering it appears?
        setTimeout(() => element.scrollIntoView(), SCROLL_DELAY_MS);

        // Remove hash from URL after jumping
        // This leaves an empty hash in the URL but that's OK for now...
        window.location.hash = '';
    }, [id, element, location.hash, collapsedCafeIdsNotifier, cafe.id, collapsedStationNamesNotifier, stationId, anchorId]);

    return (
        <a className="scroll-anchor" href={`#${id}`} ref={setElement} style={{ scrollMargin: margin }}/>
    );
};