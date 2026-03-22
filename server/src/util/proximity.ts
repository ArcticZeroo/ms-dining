import { ILocationCoordinates } from '@msdining/common/models/util';
import { getDistanceBetweenCoordinates } from '@msdining/common/util/coordinates';
import { CAFE_GROUP_LIST, CAFES_BY_ID } from '../constants/cafes.js';
import { CafeGroup } from '../models/cafe.js';

// Sigmoid parameters for proximity weighting
const SIGMOID_STEEPNESS = 4;
const SIGMOID_MIDPOINT_KM = 1.2;
const MAX_RECOMMENDATION_DISTANCE_KM = 2.5;
const CLOSE_BOOST_THRESHOLD_KM = 0.3;
const CLOSE_BOOST_MULTIPLIER = 1.2;

// Pre-computed lookup from cafeId → parent group
const GROUP_BY_CAFE_ID = new Map<string, CafeGroup>();
for (const group of CAFE_GROUP_LIST) {
    for (const member of group.members) {
        GROUP_BY_CAFE_ID.set(member.id, group);
    }
}

export const getCafeLocation = (cafeId: string): ILocationCoordinates | null => {
    const cafe = CAFES_BY_ID.get(cafeId);
    if (cafe?.location) {
        return cafe.location;
    }

    const group = GROUP_BY_CAFE_ID.get(cafeId);
    if (group?.location) {
        return group.location;
    }

    return null;
};

const getMinDistanceToAnyCafe = (targetCafeId: string, referenceCafeIds: string[]): number | null => {
    const targetLocation = getCafeLocation(targetCafeId);
    if (!targetLocation) {
        return null;
    }

    let minDistance: number | null = null;
    for (const referenceCafeId of referenceCafeIds) {
        const referenceLocation = getCafeLocation(referenceCafeId);
        if (!referenceLocation) {
            continue;
        }
        const distance = getDistanceBetweenCoordinates(targetLocation, referenceLocation);
        if (minDistance === null || distance < minDistance) {
            minDistance = distance;
        }
    }

    return minDistance;
};

/**
 * Sigmoid-based proximity weight with close-range boost and hard cutoff.
 *
 * - distance ≥ MAX_RECOMMENDATION_DISTANCE_KM → 0 (excluded)
 * - distance ≤ CLOSE_BOOST_THRESHOLD_KM → CLOSE_BOOST_MULTIPLIER (~1.2, prioritized)
 * - otherwise → sigmoid curve from ~1.0 down to ~0.0
 */
export const computeProximityWeight = (distanceKm: number): number => {
    if (distanceKm >= MAX_RECOMMENDATION_DISTANCE_KM) {
        return 0;
    }
    if (distanceKm <= CLOSE_BOOST_THRESHOLD_KM) {
        return CLOSE_BOOST_MULTIPLIER;
    }
    return 1 / (1 + Math.exp(SIGMOID_STEEPNESS * (distanceKm - SIGMOID_MIDPOINT_KM)));
};

/**
 * Pre-computes proximity weights for all known cafes relative to the given homepage cafe IDs.
 * Each cafe's weight is based on its distance to the nearest homepage cafe.
 * Returns null if no homepage cafes have location data.
 */
export const buildProximityWeightMap = (homepageIds: string[], cafeIdFilter?: Set<string>): Map<string, number> | null => {
    if (cafeIdFilter || homepageIds.length === 0) {
        return null;
    }

    const weights = new Map<string, number>();
    let hasAnyLocation = false;
    for (const cafeId of CAFES_BY_ID.keys()) {
        const distance = getMinDistanceToAnyCafe(cafeId, homepageIds);
        if (distance === null) {
            // No location data for this cafe; don't filter it out
            weights.set(cafeId, 1);
            continue;
        }
        hasAnyLocation = true;
        weights.set(cafeId, computeProximityWeight(distance));
    }

    if (!hasAnyLocation) {
        return null;
    }

    return weights;
};
