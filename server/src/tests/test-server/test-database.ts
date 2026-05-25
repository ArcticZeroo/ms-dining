/**
 * Test database lifecycle — temp directory, schema push, and cafe seeding.
 *
 * Used by `createIntegrationTestContext` to stand up a fresh, isolated
 * SQLite database for each test file.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { disconnectPrismaClient } from '../../worker/data/storage/client.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { applySchemaToTempDb } from './db-test-helper.js';

export interface TestDatabase {
    /** Filesystem path to the temp dining.db. */
    dbPath: string;
    /** Filesystem path to the temp search.db. */
    searchDbPath: string;
    /** Remove temp directory and disconnect Prisma. */
    cleanup(): Promise<void>;
}

/**
 * Creates a fresh temp directory with an empty dining.db (schema applied)
 * and search.db, sets `DATABASE_URL` and `SEARCH_DB_PATH` env vars, and
 * seeds all known cafes so FK constraints are satisfied.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
    const testId = `test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const dbDir = path.join(os.tmpdir(), 'ms-dining-tests', testId);
    await fs.promises.mkdir(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, 'dining.db');
    const searchDbPath = path.join(dbDir, 'search.db');

    // Set env BEFORE first storage/AI consumer triggers init.
    // Both api/storage/client.ts (Prisma) and api/storage/vector/db.ts (vec)
    // are lazy, so as long as no module has triggered their factories yet,
    // setting env here is sufficient.
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SEARCH_DB_PATH = searchDbPath;
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    // Push schema to the empty dining.db
    await applySchemaToTempDb(dbPath);

    // Seed all known cafes so FK constraints are satisfied
    const { PrismaClient } = await import('@prisma/client');
    const seedPrisma = new PrismaClient({ datasourceUrl: `file:${dbPath}` });
    try {
        await seedPrisma.cafe.createMany({
            data: ALL_CAFES.map(cafe => ({
                id:               cafe.id,
                name:             cafe.name,
                tenantId:         '',
                contextId:        '',
                displayProfileId: '',
                storeId:          '',
                externalName:     cafe.id,
            })),
        });
    } finally {
        await seedPrisma.$disconnect();
    }

    const cleanup = async (): Promise<void> => {
        try {
            await disconnectPrismaClient();
        } catch {
            // Best-effort: a failed disconnect shouldn't block cleanup.
        }
        // Prisma's native query engine closes handles asynchronously after
        // disconnect() resolves. On Windows, --test-force-exit can kill the
        // process while those handles are still closing, triggering a libuv
        // assertion. A brief yield lets the event loop drain them.
        await new Promise(resolve => setTimeout(resolve, 100));
        // search.db may still be held open by the worker thread; try to
        // remove the whole dir and ignore EBUSY (the OS will reap it once
        // handles are released, and the temp dir is in os.tmpdir() anyway).
        try {
            await fs.promises.rm(dbDir, { recursive: true, force: true });
        } catch {
            // Ignore — best-effort cleanup.
        }
    };

    return { dbPath, searchDbPath, cleanup };
}
