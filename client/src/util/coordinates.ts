import { ILocationCoordinates } from '@msdining/common/models/util';
import { getPercentileIndex } from "./stats.ts";

export { convertKmToMiles, getDistanceBetweenCoordinates } from '@msdining/common/util/coordinates';

export interface ILeafletLocation {
    lat: number;
    lng: number;
}

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