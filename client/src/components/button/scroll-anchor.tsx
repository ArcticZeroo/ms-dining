import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CurrentCafeContext, CurrentStationContext } from '../../context/menu-item.ts';
import { CafeCollapseContext, StationCollapseContext } from '../../context/collapse.ts';

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
    const stationName = useContext(CurrentStationContext);

    useEffect(() => {
        if (element == null) {
            return;
        }

        if (location.hash !== `#${id}`) {
            return;
        }

        // It's OK if these are empty. Nothing will happen.
        collapsedCafeIdsNotifier.delete(cafe.id);
        collapsedStationNamesNotifier.delete(stationName);

        // Jump to hash after render
        setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });

            // Remove hash from URL after jumping
            const url = new URL(window.location.href);
            url.hash = '';

            navigate(url.pathname);
        }, 0);
    }, [navigate, id, element, location.hash, collapsedCafeIdsNotifier, cafe.id, collapsedStationNamesNotifier, stationName]);

    return (
        <a className="scroll-anchor" href={`#${id}`} ref={setElement} style={{ scrollMargin: margin }}/>
    );
}