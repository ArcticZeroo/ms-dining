import React, { useContext, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CafeCollapseContext, StationCollapseContext } from '../../context/collapse.ts';
import { CurrentCafeContext, CurrentStationContext } from '../../context/menu-item.ts';

interface IScrollAnchorProps {
    id: string;
    margin?: string;
}

export const ScrollAnchor: React.FC<IScrollAnchorProps> = ({ id, margin }) => {
    const [element, setElement] = useState<HTMLAnchorElement | null>();
    const location = useLocation();
    const navigate = useNavigate();

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
        element.scrollIntoView({ behavior: 'smooth' });

        // Remove hash from URL after jumping
        const url = new URL(window.location.href);
        url.hash = '';

        navigate(url.pathname);
    }, [navigate, id, element, location.hash, collapsedCafeIdsNotifier, cafe.id, collapsedStationNamesNotifier, stationId, anchorId]);

    return (
        <a className="scroll-anchor" href={`#${id}`} ref={setElement} style={{ scrollMargin: margin }}/>
    );
};