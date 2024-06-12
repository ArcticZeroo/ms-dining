import L from 'leaflet';
import React, { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { toLeafletLocation } from '../../../util/user-location.ts';
import { getViewEmoji, getViewLocation } from '../../../util/view.ts';

const getIconHtml = (view: CafeView, isHomepageView: boolean) => `
<span class="cafe-marker-tracker flex flex-center${isHomepageView ? ' is-homepage-view' : ''}" data-id="${view.value.id}">
    ${getViewEmoji(view)}
</span>
`;

interface ICafeMarkerProps {
    view: CafeView;
    onClick(view: CafeView): void;
}

export const CafeMarker: React.FC<ICafeMarkerProps> = ({ view, onClick }) => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const isOnHomepage = useMemo(
        () => {
            return homepageViewIds.has(view.value.id)
                   || (!shouldUseGroups
                       && view.type === CafeViewType.group
                       && view.value.members.some(member => homepageViewIds.has(member.id)));
        },
        [homepageViewIds, shouldUseGroups, view]
    );

    return (
        <Marker
            position={toLeafletLocation(getViewLocation(view))}
            icon={L.divIcon({ html: getIconHtml(view, isOnHomepage) })}
            eventHandlers={{
                click: () => onClick(view)
            }}
        />
    );
};