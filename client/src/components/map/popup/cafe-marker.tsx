import L from 'leaflet';
import React from 'react';
import { Marker } from 'react-leaflet';
import { CafeView } from '../../../models/cafe.ts';
import { toLeafletLocation } from '../../../util/user-location.ts';
import { getViewEmoji, getViewLocation } from '../../../util/view.ts';

const getIconHtml = (view: CafeView) => `
<span class="cafe-marker-tracker flex flex-center" data-id="${view.value.id}">
    ${getViewEmoji(view)}
</span>
`;

interface ICafeMarkerProps {
    view: CafeView;
    onClick(view: CafeView): void;
}

export const CafeMarker: React.FC<ICafeMarkerProps> = ({ view, onClick }) => (
    <Marker
        position={toLeafletLocation(getViewLocation(view))}
        icon={L.divIcon({ html: getIconHtml(view) })}
        eventHandlers={{
            click: () => onClick(view)
        }}
    />
);