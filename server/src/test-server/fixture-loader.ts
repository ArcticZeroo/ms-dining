/**
 * Fixture loader: reads JSON fixture files from the fixtures/ directory
 * and registers them with a TestBuyOnDemandServer instance.
 *
 * Directory structure:
 *   fixtures/default/         → fallback data for any cafe
 *   fixtures/overrides/{id}/  → per-cafe overrides
 */

import { TestBuyOnDemandServer } from './index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always resolve fixtures from src/test-server/fixtures so the same path
// works whether we're running via tsx (where __dirname is src/test-server)
// or compiled (where __dirname is dist/test-server). In both cases, .. ..
// gets us to the server/ root, then we descend into src/test-server/fixtures.
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_DIR = path.join(SERVER_ROOT, 'src', 'test-server', 'fixtures');

const FIXTURE_FILES = ['config', 'stations', 'menu-items', 'tags'] as const;

function loadJsonFile(filePath: string): unknown | undefined {
    let text: string;
    try {
        text = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        // Missing files are expected for optional fixtures; anything else
        // (permissions, disk error) should surface to the test.
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return undefined;
        }
        throw err;
    }
    try {
        return JSON.parse(text);
    } catch (err) {
        throw new Error(`Failed to parse fixture JSON at ${filePath}: ${(err as Error).message}`);
    }
}

/**
 * Load all fixture files from the default and override directories
 * into the given server instance.
 */
export function loadFixtures(server: TestBuyOnDemandServer): void {
    // Load defaults
    for (const fixture of FIXTURE_FILES) {
        const filePath = path.join(FIXTURES_DIR, 'default', `${fixture}.json`);
        const data = loadJsonFile(filePath);
        if (data !== undefined) {
            server.setFixture('__default__', fixture, data);
        }
    }

    // Load per-cafe overrides (if the overrides directory exists)
    const overridesDir = path.join(FIXTURES_DIR, 'overrides');
    let cafeIds: string[];
    try {
        cafeIds = fs.readdirSync(overridesDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return;
        }
        throw err;
    }

    for (const cafeId of cafeIds) {
        for (const fixture of FIXTURE_FILES) {
            const filePath = path.join(overridesDir, cafeId, `${fixture}.json`);
            const data = loadJsonFile(filePath);
            if (data !== undefined) {
                server.setFixture(cafeId, fixture, data);
            }
        }
    }
}

/**
 * Create a TestBuyOnDemandServer with all fixtures pre-loaded.
 */
export function createTestServerWithFixtures(): TestBuyOnDemandServer {
    const server = new TestBuyOnDemandServer();
    loadFixtures(server);
    return server;
}
