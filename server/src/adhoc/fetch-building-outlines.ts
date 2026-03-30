// Fetches Microsoft campus building outlines from the OpenStreetMap Overpass API
// and writes them to common/src/constants/buildings-geo.generated.ts.
//
// Usage: cd server && npx tsx src/adhoc/fetch-building-outlines.ts

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Bounding box covering the Microsoft Redmond campus area (wider to catch Esterra etc.)
const BBOX = '47.60,-122.22,47.72,-122.08';

const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  way["building"]["name"](${BBOX});
  way(id:89129209,89129193,89129185,89129198,89129190,89129211);
);
out body;
>;
out skel qt;
`;

interface IOverpassElement {
    type: 'node' | 'way';
    id: number;
    lat?: number;
    lon?: number;
    nodes?: number[];
    tags?: Record<string, string>;
}

interface IOverpassResponse {
    elements: IOverpassElement[];
}

interface IBuildingGeoEntry {
    name: string;
    number?: number;
    centroid: { lat: number; long: number };
    polygon: number[][][];
}

// Hardcoded list of building names we want to include.
// Keys are the normalized name we output; values are the OSM name patterns to match.
// Add new buildings here when needed.
const BUILDING_NAME_MAP: Record<string, string> = {
    // Numbered buildings
    'Building 1':   'Microsoft Building 1',
    'Building 2':   'Microsoft Building 2',
    'Building 3':   'Microsoft Building 3',
    'Building 4':   'Microsoft Building 4',
    'Building 5':   'Microsoft Building 5',
    'Building 6':   'Microsoft Building 6',
    'Building 7':   'Microsoft Building 7',
    'Building 8':   'Microsoft Building 8',
    'Building 9':   'Microsoft Building 9',
    // 'Building 10':  'Microsoft Building 10',
    // 'Building 11':  'Microsoft Building 11',
    // 'Building 12':  'Microsoft Building 12',
    // 'Building 14':  'Microsoft Building 14',
    'Building 16':  'Microsoft Building 16',
    'Building 17':  'Microsoft Building 17',
    'Building 18':  'Microsoft Building 18',
    'Building 19':  'Microsoft Building 19',
    'Building 20':  'Microsoft Building 20',
    'Building 22':  'Microsoft Building 22',
    'Building 25':  'Microsoft Building 25',
    'Building 27':  'Microsoft Building 27',
    'Building 28':  'Microsoft Building 28',
    'Building 30':  'Microsoft Building 30',
    'Building 31':  'Microsoft Building 31',
    'Building 32':  'Microsoft Building 32',
    'Building 33':  'Microsoft Building 33',
    'Building 34':  'Microsoft Building 34',
    'Building 35':  'Microsoft Building 35',
    'Building 36':  'Microsoft Building 36',
    'Building 37':  'Microsoft Building 37',
    'Building 40':  'Microsoft Building 40',
    'Building 41':  'Microsoft Building 41',
    'Building 42':  'Microsoft Building 42',
    'Building 43':  'Microsoft Building 43',
    'Building 44':  'Microsoft Building 44',
    'Building 50':  'Microsoft Building 50',
    'Building 83':  'Microsoft Building 83',
    'Building 84':  'Microsoft Building 84',
    'Building 85':  'Microsoft Building 85',
    'Building 86':  'Microsoft Building 86',
    'Building 87':  'Microsoft Building 87',
    'Building 88':  'Microsoft Building 88',
    'Building 92':  'Microsoft Building 92',
    'Building 99':  'Building 99',
    'Building 109': 'Microsoft Building 109',
    'Building 111': 'Microsoft Building 111',
    'Building 112': 'Microsoft Building 112',
    'Building 113': 'Microsoft Building 113',
    'Building 114': 'Microsoft Building 114',
    'Building 115': 'Microsoft Building 115',
    'Building 120': 'Microsoft Building 120',
    'Building 121': 'Microsoft Building 121',
    'Building 122': 'Microsoft Building 122',
    'Building 123': 'Microsoft Building 123',
    'Building 124': 'Microsoft Building 124',
    'Building 125': 'Microsoft Building 125',
    'Building 126': 'Microsoft Building 126',
    'Building 127': 'Microsoft Building 127',

    // Standalone cafe structures
    'Cafe 16':     'Microsoft Cafe 16',
    'Cafe 31':     'Microsoft Cafe 31',
    'Cafe 40/41':  'Microsoft Cafe 40/41',
    'Cafe 43':     'Microsoft Cafe 43',
    'Cafe RedW-F': 'Cafe RedW-F',

    // Studios
    'Studio A': 'Microsoft Studio A',
    'Studio B': 'Microsoft Studio B',
    'Studio C': 'Microsoft Studio C',
    'Studio D': 'Microsoft Studio D',
    'Studio E': 'Microsoft Studio E',
    'Studio F': 'Microsoft Studio F',
    'Studio G': 'Microsoft Studio G',
    'Studio H': 'Microsoft Studio H',
    'Studio X': 'Microsoft Studio X',

    // RedWest campus
    'RedWest A': 'RedWest-A',
    'RedWest B': 'RedWest-B',
    'RedWest C': 'RedWest-C',
    'RedWest D': 'RedWest-D',
    'RedWest E': 'RedWest-E',

    // Other named buildings
    'One Esterra':  'One Esterra',
    'The Mixer':    'Microsoft Mixer',
    'The Submixer': 'Microsoft Submixer',

    // RTC (may not be in OSM under these names)
    'RTC B5': 'Microsoft RTC B5',
    'RTC B6': 'Microsoft RTC B6',
};

// Millennium campus buildings are tagged with single-letter names (A-F) in OSM with no
// Microsoft attribution, located near NE Union Hill Rd (~47.678, -122.093).
// We identify them by OSM way ID to avoid matching random lettered buildings elsewhere.
const MILLENNIUM_WAY_IDS: Record<number, string> = {
    89129209: 'Millennium A',
    89129193: 'Millennium B',
    89129185: 'Millennium C',
    89129198: 'Millennium D',
    89129190: 'Millennium E',
    89129211: 'Millennium F',
};

// Reverse lookup: OSM name -> our normalized name (for non-Millennium buildings)
const osmNameToNormalized = new Map<string, string>();
for (const [normalized, osmName] of Object.entries(BUILDING_NAME_MAP)) {
    osmNameToNormalized.set(osmName, normalized);
}

/** Given an OSM way's tags and ID, return our display name or undefined if not wanted. */
const resolveBuilding = (tags: Record<string, string>, wayId: number): string | undefined => {
    // Check Millennium by way ID first (they have generic single-letter names)
    const millenniumName = MILLENNIUM_WAY_IDS[wayId];
    if (millenniumName) return millenniumName;

    const osmName = tags['name'];
    if (!osmName) return undefined;

    // Check exact name match
    const exact = osmNameToNormalized.get(osmName);
    if (exact) return exact;

    return undefined;
};

const extractBuildingNumber = (name: string): number | undefined => {
    const match = name.match(/^(?:Microsoft )?Building (\d+)/i);
    return match?.[1] ? parseInt(match[1], 10) : undefined;
};

const computeCentroid = (coords: number[][]): { lat: number; long: number } => {
    let latSum = 0;
    let lonSum = 0;
    const first = coords[0];
    const last = coords[coords.length - 1];
    // Polygon coords have a repeated last point; exclude it
    const count = coords.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]
        ? coords.length - 1
        : coords.length;

    for (let i = 0; i < count; i++) {
        const coord = coords[i];
        if (coord) {
            lonSum += coord[0] ?? 0;
            latSum += coord[1] ?? 0;
        }
    }

    return {
        lat:  parseFloat((latSum / count).toFixed(8)),
        long: parseFloat((lonSum / count).toFixed(8)),
    };
};

const roundCoord = (n: number): number => parseFloat(n.toFixed(7));

async function main() {
    console.log('Fetching building data from Overpass API...');

    const response = await fetch(OVERPASS_API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    });

    if (!response.ok) {
        throw new Error(`Overpass API returned ${response.status}: ${await response.text()}`);
    }

    const data: IOverpassResponse = await response.json();
    console.log(`Received ${data.elements.length} elements from Overpass API`);

    // Build node lookup
    const nodesById = new Map<number, { lat: number; lon: number }>();
    for (const el of data.elements) {
        if (el.type === 'node' && el.lat != null && el.lon != null) {
            nodesById.set(el.id, { lat: el.lat, lon: el.lon });
        }
    }

    // Process ways into buildings
    const buildings: IBuildingGeoEntry[] = [];
    const foundNames = new Set<string>();

    for (const el of data.elements) {
        if (el.type !== 'way' || !el.nodes) {
            continue;
        }

        // Millennium buildings may not have a name tag, so check by ID first
        const isMillennium = el.id in MILLENNIUM_WAY_IDS;
        if (!isMillennium && !el.tags?.name) {
            continue;
        }

        const normalizedName = resolveBuilding(el.tags ?? {}, el.id);

        if (!normalizedName || foundNames.has(normalizedName)) {
            continue;
        }
        foundNames.add(normalizedName);

        // Resolve node references to coordinates
        const coords: number[][] = [];
        let missingNodes = false;

        for (const nodeId of el.nodes) {
            const node = nodesById.get(nodeId);
            if (!node) {
                missingNodes = true;
                break;
            }
            coords.push([roundCoord(node.lon), roundCoord(node.lat)]);
        }

        if (missingNodes || coords.length < 4) {
            console.warn(`  Skipping ${normalizedName}: missing nodes or too few coordinates`);
            continue;
        }

        const centroid = computeCentroid(coords);
        const number = extractBuildingNumber(normalizedName);

        buildings.push({
            name: normalizedName,
            number,
            centroid,
            polygon: [coords],
        });
    }

    // Sort by building number (numbered first), then by name
    buildings.sort((a, b) => {
        if (a.number != null && b.number != null) return a.number - b.number;
        if (a.number != null) return -1;
        if (b.number != null) return 1;
        return a.name.localeCompare(b.name);
    });

    // Report missing buildings
    const foundNormalized = new Set(buildings.map(b => b.name));
    const allExpected = [...Object.keys(BUILDING_NAME_MAP), ...Object.values(MILLENNIUM_WAY_IDS)];
    const missing = allExpected.filter(n => !foundNormalized.has(n));
    if (missing.length > 0) {
        console.warn(`\nMissing ${missing.length} buildings (not found in OSM):`);
        for (const name of missing) {
            console.warn(`  ${name}`);
        }
    }

    console.log(`\nProcessed ${buildings.length} of ${allExpected.length} expected buildings`);

    // Generate TypeScript output
    const outputPath = resolve(import.meta.dirname, '../../../common/src/constants/buildings-geo.generated.ts');

    const lines = [
        '// Auto-generated from OpenStreetMap Overpass API. Do not manually edit.',
        '// To regenerate, run: cd server && npx tsx src/adhoc/fetch-building-outlines.ts',
        '',
        'interface IBuildingGeoEntry {',
        '    name: string;',
        '    number?: number;',
        '    centroid: { lat: number; long: number };',
        '    polygon: number[][][];',
        '}',
        '',
        `export const BUILDING_GEO_DATA: IBuildingGeoEntry[] = ${JSON.stringify(buildings)};`,
        '',
    ];

    writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    console.log(`Written to ${outputPath}`);
    console.log('Done! Remember to rebuild common (cd common && npx tsc) after regenerating.');
}

main().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
