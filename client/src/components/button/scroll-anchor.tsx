import React, { useContext, useEffect, useState } from 'react';
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

    useEffect(() => {
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
        setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });

            // Remove hash from URL after jumping
            const url = new URL(window.location.href);
            url.hash = '';

            navigate(url.pathname);
        }, 0);
    }, [navigate, id, element, location.hash, collapsedCafeIdsNotifier, cafe.id, collapsedStationNamesNotifier, stationId]);

    // perf: Don't bother rendering the anchor if it's not needed
    if (location.hash !== anchorId) {
        return;
    }

    return (
        <a className="scroll-anchor" href={`#${id}`} ref={setElement} style={{ scrollMargin: margin }}/>
    );
};