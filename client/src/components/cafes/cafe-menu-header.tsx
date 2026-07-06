import { minutesToTimeString } from '@msdining/common/util/date-util';
import React, { useMemo } from 'react';
import { ApplicationSettings, DebugSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { DeviceType, useDeviceType } from '../../hooks/media-query.js';
import { ICafe } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { ExpandIcon } from '../icon/expand.tsx';
import type { ICafeMenuView } from './cafe-menu-view.tsx';
import { CafeMenuControls } from './cafe-menu-controls.js';

const useCafeName = (cafe: ICafe, showGroupName: boolean) => {
    return useMemo(() => getCafeName({ cafe, showGroupName }), [cafe, showGroupName]);
};

const useCafeHoursString = (menuData: ICafeMenuView): string | undefined => {
    return useMemo(() => {
        const stations = menuData.data?.stations;
        if (!stations || stations.length === 0) {
            return undefined;
        }

        let minOpensAt = Infinity;
        let maxClosesAt = -Infinity;
        for (const station of stations) {
            minOpensAt = Math.min(minOpensAt, station.opensAt);
            maxClosesAt = Math.max(maxClosesAt, station.closesAt);
        }

        if (!isFinite(minOpensAt) || !isFinite(maxClosesAt)) {
            console.error('Unexpected Infinity for opensAt/closesAt', stations);
            return undefined;
        }

        return `${minutesToTimeString(minOpensAt)} – ${minutesToTimeString(maxClosesAt)}`;
    }, [menuData.data]);
};

interface ICafeMenuHeaderProps {
    cafe: ICafe;
    showGroupName: boolean;
    isCollapsed: boolean;
    openedRecently: boolean;
    menuData: ICafeMenuView;
    onToggle: () => void;
    headerRef: (element: HTMLDivElement | null) => void;
}

export const CafeMenuHeader: React.FC<ICafeMenuHeaderProps> = ({
    cafe,
    showGroupName,
    isCollapsed,
    openedRecently,
    menuData,
    onToggle,
    headerRef,
}) => {
    const deviceType = useDeviceType();
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const showCafeHours = useValueNotifier(DebugSettings.showCafeHours);
    const cafeName = useCafeName(cafe, showGroupName);
    const cafeHoursString = useCafeHoursString(menuData);

    const showCafeLogo = showImages && cafe.logoUrl != null;

    return (
        <div className="cafe-header" ref={headerRef}>
            <div role="button" className="collapse-toggle" onClick={onToggle}>
                <span className="grid-justify-start">
                    {
                        showCafeLogo && (
                            <img src={cafe.logoUrl}
                                alt={`${cafe.name} logo`}
                                className="logo"
                            />
                        )
                    }
                </span>
                <div className="flex-col constant-gap">
                    <span className="cafe-name">
                        {cafeName}
                        <ExpandIcon isExpanded={!isCollapsed}/>
                    </span>
                    {
                        showCafeHours && cafeHoursString && (
                            <span className="cafe-hours">{cafeHoursString}</span>
                        )
                    }
                </div>
                <span className="flex grid-justify-end">
                    {
                        deviceType === DeviceType.Desktop && (
                            <CafeMenuControls
                                cafeName={cafeName}
                                menuData={menuData}
                            />
                        )
                    }
                    {
                        openedRecently && <span className="default-container recently-opened-notice">New!</span>
                    }
                </span>
            </div>
            {
                deviceType === DeviceType.Mobile && !isCollapsed && (
                    <CafeMenuControls
                        cafeName={cafeName}
                        menuData={menuData}
                    />
                )
            }
        </div>
    );
};
