import { CafeViewType, ICafe } from '../../../../models/cafe.js';
import { ICafeOverviewStation } from '@msdining/common/models/cafe';
import React, { useContext, useMemo } from 'react';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { getCafeName } from '../../../../util/cafe.js';
import { classNames } from '../../../../util/react.js';
import { Link } from 'react-router-dom';
import { getViewMenuUrl } from '../../../../util/link.js';
import { CafeOverview } from './cafe-overview.js';
import { ApplicationContext } from '../../../../context/app.js';
import { useValueNotifier } from '../../../../hooks/events.js';
import { ApplicationSettings } from '../../../../constants/settings.js';
import { MapSelectedViewContext } from '../../../../context/map.js';

interface IViewOverviewCafeProps {
    cafe: ICafe;
    overviewStations: Array<ICafeOverviewStation> | undefined;
    showAllStations: boolean;
}

export const OverviewMemberDetails: React.FC<IViewOverviewCafeProps> = ({ cafe, overviewStations, showAllStations }) => {
    const outerView = useContext(MapSelectedViewContext);
    const { viewsById } = useContext(ApplicationContext);
    const view = viewsById.get(cafe.id);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const openedRecently = useMemo(
        () => {
            return getIsRecentlyAvailable(cafe.firstAvailableDate);
        },
        [cafe]
    );

    if (!outerView || !view) {
        return null;
    }

    const cafeName = getCafeName({
        cafe,
        showGroupName: false,
        includeEmoji:  true
    });
    
    return (
        <div className={classNames('group-member flex-col flex-center', openedRecently && 'recently-opened')}>
            {
                outerView.type === CafeViewType.group && (
                    // Intentionally getting the URL for the cafe's view instead of the popup
                    <Link to={getViewMenuUrl({ view, viewsById, shouldUseGroups })} className="flex default-button default-container">
                        {
                            cafe.logoUrl && (
                                <img src={cafe.logoUrl}
                                    alt={`${cafe.name} logo`}
                                    className="logo-small"/>
                            )
                        }
                        <span>
                            {cafeName}
                        </span>
                    </Link>
                )
            }
            {
                openedRecently && (
                    <span className="recently-opened-notice default-container">
                        New!
                    </span>
                )
            }
            <CafeOverview
                cafe={cafe}
                stations={overviewStations}
                showAllStations={showAllStations}
            />
        </div>
    );
}