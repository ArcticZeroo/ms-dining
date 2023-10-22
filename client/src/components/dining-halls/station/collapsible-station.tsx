import { ICafeStation } from '../../../models/cafe.ts';
import React, { useEffect, useRef, useState } from 'react';
import { StationMenu } from './menu-items/station-menu.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { classNames } from '../../../util/react.ts';
import { DeviceType, useDeviceType } from '../../../hooks/media-query.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ApplicationSettings } from '../../../api/settings.ts';

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
    const rememberCollapseState = useValueNotifier(ApplicationSettings.rememberCollapseState);
    const collapsedStationNames = useValueNotifier(ApplicationSettings.collapsedStationNames);

    const [isExpanded, setIsExpanded] = useState(true);
    const menuBodyRef = useRef<HTMLDivElement>(null);
    const [menuWidthPx, setMenuWidthPx] = useState<number | undefined>(undefined);

    const stationStyle = useStationStyle(isExpanded, menuWidthPx);

    const updateExpansionState = (isNowExpanded: boolean) => {
        const menuBodyElement = menuBodyRef.current;

        if (menuBodyElement && !isNowExpanded) {
            // Apparently the browser sometimes renders with partial pixels. Why?
            setMenuWidthPx(Math.ceil(menuBodyElement.offsetWidth));
        } else {
            setMenuWidthPx(undefined);
        }

        setIsExpanded(isNowExpanded);
    };

    const onTitleClick = () => {
        const isNowExpanded = !isExpanded;

        updateExpansionState(isNowExpanded);

        if (isNowExpanded) {
            ApplicationSettings.collapsedStationNames.delete(station.name);
        } else {
            ApplicationSettings.collapsedStationNames.add(station.name);
        }
    }

    // Collapse memory is a boot setting. Also allows one render for width consistency.
    useEffect(() => {
        if (rememberCollapseState) {
            const isExpanded = !collapsedStationNames.has(station.name);
            updateExpansionState(isExpanded);
        }
    }, []);

    return (
        <div className={classNames('station', !isExpanded && 'collapsed')} style={stationStyle}>
            <button className="title" onClick={onTitleClick}>
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