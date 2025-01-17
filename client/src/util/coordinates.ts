import { ILocationCoordinates } from '@msdining/common/dist/models/util';
import { getPercentileIndex } from "./stats.ts";

const EARTH_RADIUS_KM = 6371.137;
const DEGREES_TO_RADIANS = Math.PI / 180;

export interface ILeafletLocation {
    lat: number;
    lng: number;
}

export const convertKmToMiles = (km: number): number => km * 0.621371;

export const getDistanceBetweenCoordinates = (start: ILocationCoordinates, end: ILocationCoordinates, inMiles: boolean = false): number => {
    const deltaLongitude = (end.long - start.long) * DEGREES_TO_RADIANS;
    const deltaLatitude = (end.lat - start.lat) * DEGREES_TO_RADIANS;

    // Haversine formula
    // https://en.wikipedia.org/wiki/Haversine_formula
    //
    const a = Math.pow(Math.sin(deltaLatitude / 2), 2)
              + (
                  Math.cos(start.lat * DEGREES_TO_RADIANS)
                  * Math.cos(end.lat * DEGREES_TO_RADIANS)
                  * Math.pow(Math.sin(deltaLongitude / 2), 2)
              );

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceInKm = EARTH_RADIUS_KM * c;
    return inMiles ? convertKmToMiles(distanceInKm) : distanceInKm;
};

export const toLeafletLocation = (location: ILocationCoordinates): ILeafletLocation => ({
    lat: location.lat,
    lng: location.long
});

const removeCoordinateOutliers = (values: number[]) => {
    values.sort((a, b) => a - b);
    const lowIndex = getPercentileIndex(values, 0.2);
    const highIndex = getPercentileIndex(values, 0.8);
    return values.slice(lowIndex, highIndex + 1);
}

export const calculateCenter = (locations: ILocationCoordinates[]): ILocationCoordinates => {
    const latitudes: number[] = [];
    const longitudes: number[] = [];

    for (const location of locations) {
        latitudes.push(location.lat);
        longitudes.push(location.long);
    }

    const latitudesWithoutOutliers = removeCoordinateOutliers(latitudes);
    const longitudesWithoutOutliers = removeCoordinateOutliers(longitudes);

    const latSum = latitudesWithoutOutliers.reduce((acc, lat) => acc + lat, 0);
    const longSum = longitudesWithoutOutliers.reduce((acc, long) => acc + long, 0);

    return {
        lat: latSum / latitudesWithoutOutliers.length,
        long: longSum / longitudesWithoutOutliers.length
    };
}