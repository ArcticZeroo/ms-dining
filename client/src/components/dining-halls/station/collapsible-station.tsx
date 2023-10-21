import { ICafeStation } from '../../../models/cafe.ts';
import React, { useRef, useState } from 'react';
import { StationMenu } from './menu-items/station-menu.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { classNames } from '../../../util/react.ts';
import { DeviceType, useDeviceType } from '../../../hooks/media-query.ts';

const useStationStyle = (isExpanded: boolean, widthPx: number | undefined) => {
    const deviceType = useDeviceType();

    // On Mobile, the station always has max width.
    if (isExpanded || !widthPx || deviceType === DeviceType.Mobile) {
        return {};
    }

    return {
        width: `${widthPx}px`
    };
}

export interface ICollapsibleStationProps {
    station: ICafeStation;
}

export const CollapsibleStation: React.FC<ICollapsibleStationProps> = ({ station }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const menuBodyRef = useRef<HTMLDivElement>(null);
    const [menuWidthPx, setMenuWidthPx] = useState<number | undefined>(undefined);
    const stationStyle = useStationStyle(isExpanded, menuWidthPx);

    const toggleIsExpanded = () => {
        const isNowExpanded = !isExpanded;

        const menuBodyElement = menuBodyRef.current;

        if (menuBodyElement && !isNowExpanded) {
            // Apparently the browser sometimes renders with partial pixels. Why?
            setMenuWidthPx(Math.ceil(menuBodyElement.offsetWidth));
        } else {
            setMenuWidthPx(undefined);
        }

        setIsExpanded(isNowExpanded);
    }

    return (
        <div className={classNames('station', !isExpanded && 'collapsed')} style={stationStyle}>
            <button className="title" onClick={toggleIsExpanded}>
                {
                    station.logoUrl && (
                        <img src={station.logoUrl}
                             alt={`Logo for station ${station.name}`}/>
                    )
                }
                {station.name}
                <ExpandIcon isExpanded={isExpanded}/>
            </button>
            <StationMenu menuItemsByCategoryName={station.menu} ref={menuBodyRef}/>
        </div>
    );
};