import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { MapSelectedViewContext } from '../../../context/map.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeViewType, ICafe } from '../../../models/cafe.ts';
import { getCafeName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { classNames } from '../../../util/react.ts';
import { CafeOverview } from './overview/cafe-overview.tsx';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';

interface ICampusMapViewDetailsMember {
    cafe: ICafe;
    showAllStations?: boolean;
}

export const CampusMapViewDetailsMember: React.FC<ICampusMapViewDetailsMember> = ({ cafe, showAllStations = false }) => {
    const outerView = useContext(MapSelectedViewContext);
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const view = viewsById.get(cafe.id);
    const openedRecently = useMemo(
        () => {
            if (!view) {
                return false;
            }

            return getIsRecentlyAvailable(view.value.firstAvailableDate);
        },
        [view]
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
                showAllStations={showAllStations}
            />
        </div>
    );
};