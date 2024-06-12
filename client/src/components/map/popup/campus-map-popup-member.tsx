import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView, CafeViewType, ICafe } from '../../../models/cafe.ts';
import { getCafeName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { CafePopupOverview } from './overview/cafe-popup-overview.tsx';

interface ICampusMapPopupMember {
    popupView: CafeView;
    cafe: ICafe;
}

export const CampusMapPopupMember: React.FC<ICampusMapPopupMember> = ({ popupView, cafe }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const view = viewsById.get(cafe.id);

    if (!view) {
        return null;
    }

    const cafeName = getCafeName({
        cafe,
        showGroupName: false,
        includeEmoji:  true
    });

    return (
        <Link to={getViewMenuUrl({ view, viewsById, shouldUseGroups })} className="group-member flex-col">
            {
                popupView.type === CafeViewType.group && (
                    <span>
                        {cafeName}
                    </span>
                )
            }
            <CafePopupOverview cafe={cafe}/>
        </Link>
    );
};