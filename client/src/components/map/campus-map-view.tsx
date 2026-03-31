import { useCallback, useEffect, useState } from 'react';
import { useMarkerLabelModes } from '../../hooks/map.ts';
import { CafeView } from '../../models/cafe.ts';
import { CafeMarker } from './popup/cafe-marker.tsx';
import { MapCafeViewPopup } from './popup/map-cafe-view-popup.tsx';
import { GenericMapView } from './generic-map-view.js';

interface ICampusMapMarkersProps {
    onMarkerClick(view: CafeView): void;
}

const CampusMapMarkers: React.FC<ICampusMapMarkersProps> = ({ onMarkerClick }) => {
    const { views, labelModes } = useMarkerLabelModes();

    return (
        <>
            {views.map(view => (
                <CafeMarker
                    key={view.value.id}
                    view={view}
                    onClick={onMarkerClick}
                    labelMode={labelModes.get(view.value.id) ?? 'none'}
                />
            ))}
        </>
    );
};

const CampusMapView = () => {
    const [selectedView, setSelectedView] = useState<CafeView | null>(null);

    const onClose = useCallback(
        () => {
            setSelectedView(null);
        },
        []
    );

    useEffect(() => {
        if (selectedView == null) {
            return;
        }

        const onEscapePressed = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                event.preventDefault();
                setSelectedView(null);
            }
        };

        document.addEventListener('keydown', onEscapePressed);

        return () => {
            document.removeEventListener('keydown', onEscapePressed);
        };
    }, [selectedView]);

    const onMarkerClick = useCallback(
        (view: CafeView) => setSelectedView(view),
        []
    );

    return (
        <GenericMapView
            isMapHeight={true}
            popupContent={selectedView != null && (
                <MapCafeViewPopup
                    view={selectedView}
                    onClose={onClose}
                />
            )}
        >
            <CampusMapMarkers onMarkerClick={onMarkerClick}/>
        </GenericMapView>
    )
};

export default CampusMapView;