import L from 'leaflet';
import { CafeView } from '../models/cafe.js';
import { InternalSettings } from '../constants/settings.js';
import { getViewLocation, getViewMarkerDisplay } from './view.js';
import { calculateCenter } from './coordinates.js';
import { toLeafletLocation } from './coordinates.js';

const FULL_LABEL_MIN_DISTANCE_PX = 100;
const SHORT_LABEL_MIN_DISTANCE_PX = 50;
// Numbered markers have small bubble icons (~2rem) but no labels,
// so they need less clearance than label-bearing markers.
const ICON_ONLY_MIN_DISTANCE_PX = 20;
// Approximate pixel distance from marker center to label center below it.
const LABEL_VERTICAL_OFFSET_PX = 25;

export type MarkerLabelMode = 'full' | 'short' | 'none';

export const computeLabelModes = (views: CafeView[], map: L.Map, zoom: number): Map<string, MarkerLabelMode> => {
    const points = views.map(view => {
        const markerLabel = getViewMarkerDisplay(view);
        return {
            id:        view.value.id,
            pixel:     map.project(toLeafletLocation(getViewLocation(view)), zoom),
            showsLabel: !markerLabel.isNumber
        };
    });

    const result = new Map<string, MarkerLabelMode>();

    for (const point of points) {
        let minDistance = Infinity;
        for (const other of points) {
            if (other.id === point.id) {
                continue;
            }

            const dx = Math.abs(point.pixel.x - other.pixel.x);
            const dy = other.pixel.y - point.pixel.y; // positive = other is south

            // The label renders below the marker. Compute distance from the
            // label's position rather than the marker's position.
            // If the other marker is north, it's even further from our label.
            // If it's south, it's closer to our label.
            const labelDy = Math.abs(dy - LABEL_VERTICAL_OFFSET_PX);
            const rawDistance = Math.sqrt(dx * dx + labelDy * labelDy);

            // Numbered markers have tiny icons and never show labels,
            // so they need less clearance than label-bearing markers.
            // Boost their effective distance so they only suppress labels when very close.
            const distance = other.showsLabel ? rawDistance : rawDistance + ICON_ONLY_MIN_DISTANCE_PX;

            minDistance = Math.min(minDistance, distance);
        }

        if (minDistance > FULL_LABEL_MIN_DISTANCE_PX) {
            result.set(point.id, 'full');
        } else if (minDistance > SHORT_LABEL_MIN_DISTANCE_PX) {
            result.set(point.id, 'short');
        } else {
            result.set(point.id, 'none');
        }
    }

    return result;
};

// Intentionally not a hook, we don't want to change every time the user clicks on a new cafe
// (e.g. if the component is mounted on top of the cafe menu at some point in the future).
// Also views seems redundant here sine we have viewsById, but we don't want to weight the randomness
export const getMapCenter = (views: CafeView[], viewsById: Map<string, CafeView>) => {
    const cafesInOrder = InternalSettings.lastUsedCafeIds.value;

    for (let i = cafesInOrder.length - 1; i >= 0; i--) {
        const id = cafesInOrder[i]!;
        const view = viewsById.get(id);
        if (view != null) {
            return getViewLocation(view);
        }
    }

    return calculateCenter(views.map(getViewLocation));
};
