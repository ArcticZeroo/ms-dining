/**
 * Fixture generator CLI: writes per-cafe fixture data for all cafes to
 * fixtures/overrides/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { generateForCafe } from './fixture-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const overridesDir = path.join(__dirname, 'fixtures', 'overrides');

if (fs.existsSync(overridesDir)) {
    fs.rmSync(overridesDir, { recursive: true });
}

let totalCafes = 0;
let totalStations = 0;
let totalItems = 0;

for (const { id: cafeId } of ALL_CAFES) {
    const fixtures = generateForCafe(cafeId);
    const cafeDir = path.join(overridesDir, cafeId);
    fs.mkdirSync(cafeDir, { recursive: true });

    for (const [name, data] of Object.entries(fixtures)) {
        fs.writeFileSync(
            path.join(cafeDir, `${name}.json`),
            JSON.stringify(data, null, 2),
        );
    }

    totalCafes++;
    totalStations += fixtures.stations.length;
    totalItems += fixtures['menu-items'].length;
}

console.log(`Generated fixtures for ${totalCafes} cafes (${totalStations} stations, ${totalItems} items)`);
console.log(`Output: ${overridesDir}`);
