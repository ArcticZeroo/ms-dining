import { ILocationCoordinates } from './util.js';

export interface IBuildingOutline {
    // Display name e.g. "Building 25", "Studio A"
    name: string;
    // Building number if applicable (e.g. 25 for "Building 25")
    number?: number;
    // Associated cafe ID for visual styling (cafe buildings vs non-cafe buildings)
    cafeId?: string;
    centroid: ILocationCoordinates;
    // GeoJSON polygon coordinates [[[lon, lat], ...]]
    polygon: number[][][];
}
