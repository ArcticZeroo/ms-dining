import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../constants/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ICafe } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { getViewMenuUrl } from '../../util/link.ts';

interface ICafeMapMarkerGroupMemberProps {
    cafe: ICafe;
}

export const CafeMapMarkerGroupMember: React.FC<ICafeMapMarkerGroupMemberProps> = ({ cafe }) => {
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

    if (shouldUseGroups) {
        return (
            <div className="group-member">
                {cafeName}
            </div>
        );
    }

    return (
        <Link to={getViewMenuUrl({ view, viewsById, shouldUseGroups })} className="group-member">
            {cafeName}
        </Link>
    );
};