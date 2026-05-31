/**
 * Fixture loader: reads hand-authored default fixture files from the
 * fixtures/ directory and registers them with a TestBuyOnDemandServer
 * instance, then layers generated per-cafe fixtures on top.
 */

import { TestBuyOnDemandServer } from './index.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { generateForCafe } from './fixture-generator.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always resolve fixtures from src/tests/test-server/fixtures so the same path
// works whether we're running via tsx or compiled. __dirname at runtime is
// server/dist/tests/test-server/, so .. .. .. lands at server/, then we
// descend into src/tests/test-server/fixtures.
const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURES_DIR = path.join(SERVER_ROOT, 'src', 'tests', 'test-server', 'fixtures');

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
 * Load hand-authored default fixtures from disk and generated per-cafe
 * fixtures into the given server instance.
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

    // Translations live outside the per-cafe fixture map — they're a global
    // namespace -> code -> message registry. Load the bundled core namespace
    // via the dedicated test-only loader so resetTranslations() can restore it.
    const translationsPath = path.join(FIXTURES_DIR, 'default', 'translations.json');
    const translationsData = loadJsonFile(translationsPath) as Record<string, string> | undefined;
    if (translationsData !== undefined) {
        server.state.loadInitialTranslations('core', translationsData);
    }

    for (const { id: cafeId } of ALL_CAFES) {
        const fixtures = generateForCafe(cafeId);
        for (const fixture of FIXTURE_FILES) {
            server.setFixture(cafeId, fixture, fixtures[fixture]);
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
