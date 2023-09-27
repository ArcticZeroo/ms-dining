import { IDiningHallStation } from '../../../models/dining-halls.ts';
import React, { useRef, useState } from 'react';
import { StationMenu } from './menu-items/station-menu.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { classNames } from '../../../util/react.ts';

const getStationStyle = (isExpanded: boolean, widthPx: number | undefined) => {
    if (isExpanded || !widthPx) {
        return {};
    }

    return {
        width: `${widthPx}px`
    };
}

export interface ICollapsibleStationProps {
    station: IDiningHallStation;
}

export const CollapsibleStation: React.FC<ICollapsibleStationProps> = ({ station }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const menuBodyRef = useRef<HTMLDivElement>(null);
    const [menuWidthPx, setMenuWidthPx] = useState<number | undefined>(undefined);

    const toggleIsExpanded = () => {
        const isNowExpanded = !isExpanded;

        const menuBodyElement = menuBodyRef.current;
        console.log(menuBodyElement);

        if (menuBodyElement && !isNowExpanded) {
            console.log(menuBodyElement.offsetWidth, menuBodyElement.clientWidth, menuBodyElement.scrollWidth);
            // Apparently the browser sometimes renders with partial pixels. Why?
            setMenuWidthPx(Math.ceil(menuBodyElement.offsetWidth));
        } else {
            setMenuWidthPx(undefined);
        }

        setIsExpanded(isNowExpanded);
    }

    return (
        <div className={classNames('station', !isExpanded && 'collapsed')}
             style={getStationStyle(isExpanded, menuWidthPx)}>
            <button className="title" onClick={toggleIsExpanded}>
                {
                    station.logoUrl && (
                        <img src={station.logoUrl}
                             alt={`Logo for station ${station.name}`}
                             decoding="async"/>
                    )
                }
                {station.name}
                <ExpandIcon isExpanded={isExpanded}/>
            </button>
            <StationMenu menuItemsByCategoryName={station.menu} ref={menuBodyRef}/>
        </div>
    );
};