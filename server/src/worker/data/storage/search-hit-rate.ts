// Station/cafe hit-rate promotion thresholds.
// A station is promoted to a search match when its menu items match at a high
// enough rate, even if the station name itself didn't match the query.
const STATION_HIT_RATE_HIGH = 0.5;
const STATION_HIT_RATE_LOW = 0.15;
const STATION_HIT_MIN_COUNT = 2;
const STATION_HIT_MIN_COUNT_FOR_LOW_RATE = 3;

export interface IStationHitStats {
    matchedCount: number;
    totalCount: number;
    distanceCount: number;
    totalDistance: number;
}

export const shouldPromoteByHitRate = (stats: IStationHitStats): boolean => {
    if (stats.totalCount === 0 || stats.matchedCount < STATION_HIT_MIN_COUNT) {
        return false;
    }
    const hitRate = stats.matchedCount / stats.totalCount;
    return hitRate >= STATION_HIT_RATE_HIGH
        || (hitRate >= STATION_HIT_RATE_LOW && stats.matchedCount >= STATION_HIT_MIN_COUNT_FOR_LOW_RATE);
};

export const getAverageDistance = (stats: IStationHitStats): number | undefined => {
    if (stats.distanceCount === 0) {
        return undefined;
    }
    return stats.totalDistance / stats.distanceCount;
};
