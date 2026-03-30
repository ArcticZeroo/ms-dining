import { IBuildingOutline } from '../models/building.js';
import { BUILDING_GEO_DATA } from './buildings-geo.generated.js';

// Manual mapping of building name -> associated cafe ID (for visual styling only).
// When adding new buildings from OSM, only this map needs updating — the geo data
// in buildings-geo.generated.ts can be regenerated without losing these annotations.
const BUILDING_CAFE_ID_MAP: Record<string /*buildingDisplayName*/, string /*associatedCafeId*/> = {
    // Numbered buildings that contain (or are directly adjacent to) a cafe
    'Building 4':   'building4',
    'Building 6':   'foodhall6',
    'Building 9':   'building9',
    'Building 16':  'cafe16',
    'Building 25':  'cafe25',
    // 'Building 31':  'cafe31',
    // 'Building 34':  'cafe34',
    'Building 36':  'cafe36',
    'Building 37':  'cafe37',
    // 'Building 40':  'cafe40-41',
    // 'Building 41':  'cafe40-41',
    // 'Building 43':  'cafe43',
    'Building 50':  'cafe50',
    'Building 83':  'cafe83',
    'Building 86':  'cafe86',
    'Building 92':  'cafe92',
    'Building 99':  'cafe99',
    'Building 109': 'cafe109',
    'Building 121': 'cafe121',
    'Cafe 16':     'cafe16',
    'Cafe 31':     'cafe31',
    'Cafe 40/41':  'cafe40-41',
    'Cafe 43':     'cafe43',
    'Cafe RedW-F': 'caferedwest',
    'Studio A': 'studioa',
    'Studio D': 'studiod',
    'Studio H': 'cafestudioh',
    'RTC B5': 'cafertc5',
    'One Esterra': 'oneesterra',
    'The Mixer': 'commons',
    'The Submixer': 'commons'
};

export const MICROSOFT_BUILDINGS: IBuildingOutline[] = BUILDING_GEO_DATA.map(geo => ({
    name:     geo.name,
    number:   geo.number,
    cafeId:   BUILDING_CAFE_ID_MAP[geo.name],
    centroid: geo.centroid,
    polygon:  geo.polygon,
}));

export const BUILDINGS_BY_NAME = new Map<string, IBuildingOutline>(
    MICROSOFT_BUILDINGS.map(b => [b.name, b])
);
