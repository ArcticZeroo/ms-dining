import { ILocationCoordinates } from '@msdining/common/dist/models/util';

const EARTH_RADIUS_KM = 6371.137;
const DEGREES_TO_RADIANS = Math.PI / 180;

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