import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { MapPopupViewContext } from '../../../context/map.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeViewType, ICafe } from '../../../models/cafe.ts';
import { getCafeName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { CafePopupOverview } from './overview/cafe-popup-overview.tsx';

interface ICampusMapPopupMember {
    cafe: ICafe;
}

export const CampusMapPopupMember: React.FC<ICampusMapPopupMember> = ({ cafe }) => {
    const popupView = useContext(MapPopupViewContext);
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const view = viewsById.get(cafe.id);

    if (!popupView || !view) {
        return null;
    }

    const cafeName = getCafeName({
        cafe,
        showGroupName: false,
        includeEmoji:  true
    });

    return (
        <div className="group-member flex-col">
            {
                popupView.type === CafeViewType.group && (
                    // Intentionally getting the URL for the cafe's view instead of the popup
                    <Link to={getViewMenuUrl({ view, viewsById, shouldUseGroups })}>
                        {cafeName}
                    </Link>
                )
            }
            <CafePopupOverview
                cafe={cafe}
            />
        </div>
    );
};