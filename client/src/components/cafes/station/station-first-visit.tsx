import React, { useContext } from 'react';
import { didEntityOpenRecently } from '../../../util/cafe.ts';
import { CurrentCafeContext } from '../../../context/menu-item.ts';

interface IStationFirstVisitProps {
    firstVisit: string;
}

export const StationFirstVisit: React.FC<IStationFirstVisitProps> = ({ firstVisit }) => {
    const cafe = useContext(CurrentCafeContext);

    // If the cafe just opened, this station also just opened, so it would be redundant
    if (didEntityOpenRecently(cafe.firstAvailableDate)) {
        return null;
    }

    if (!didEntityOpenRecently(firstVisit)) {
        return null;
    }

    return (
        <div className="recently-opened-notice default-container">
            This station is new to this cafe! Try it out!
        </div>
    );
}