import React, { useContext, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { expandCafe, expandStation } from '../../store/zustand/collapse.ts';
import { CurrentCafeContext, CurrentStationScrollIdContext } from '../../context/menu-item.ts';

const SCROLL_DELAY_MS = 50;

interface IScrollAnchorProps {
    id: string;
    margin?: string;
}

export const ScrollAnchor: React.FC<IScrollAnchorProps> = ({ id, margin }) => {
    const [element, setElement] = useState<HTMLAnchorElement | null>();
    const location = useLocation();

    const cafe = useContext(CurrentCafeContext);
    const stationId = useContext(CurrentStationScrollIdContext);

    const anchorId = `#${id}`;

    useLayoutEffect(() => {
        if (element == null) {
            return;
        }

        if (location.hash !== anchorId) {
            return;
        }

        if (cafe.id !== '') {
            expandCafe(cafe.id);

            if (stationId.length > 0) {
                expandStation(stationId);
            }
        }

        // Jump to hash after render
        // Smooth seems to have problems with images loading as we scroll
        // We also have a short delay since sometimes the surrounding stuff hasn't finished rendering it appears?
        setTimeout(() => element.scrollIntoView(), SCROLL_DELAY_MS);

        // Remove hash from URL after jumping
        // This leaves an empty hash in the URL but that's OK for now...
        window.location.hash = '';
    }, [id, element, location.hash, cafe.id, stationId, anchorId]);

    return (
        <a className="scroll-anchor" href={`#${id}`} ref={setElement} style={{ scrollMargin: margin }}/>
    );
};