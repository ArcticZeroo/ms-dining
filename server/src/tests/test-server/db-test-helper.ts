/**
 * Helpers for managing per-test SQLite databases.
 *
 * `applySchemaToTempDb(dbPath)` runs `prisma db push` against the given path,
 * producing an empty, migrated SQLite database that can be opened by the
 * PrismaClient when DATABASE_URL points at it.
 *
 * `acquireTestLock` / `releaseTestLock` serialize service-level tests that
 * share the same on-disk database so they don't clobber each other when
 * node:test runs files in parallel.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pause } from '../../shared/util/async.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the server root (containing prisma/ and node_modules/) once.
// __dirname at runtime is server/dist/tests/test-server/, so go up three
// levels to reach server/. (Three because: tests/test-server → tests → dist → server.)
const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..');
const PRISMA_SCHEMA_DIR = path.join(SERVER_ROOT, 'prisma');

/**
 * Apply the production Prisma schema to a fresh SQLite database file.
 *
 * Uses `prisma migrate deploy` (not `prisma db push`) because the production
 * schema relies on hand-edited migrations — most importantly, SQLite
 * `GENERATED ALWAYS AS … STORED` columns (e.g. MenuItem.entityKey,
 * Station.entityKey) that Prisma's schema language cannot express. `db push`
 * regenerates those columns as plain `TEXT NOT NULL` with no default,
 * silently breaking inserts in tests. `migrate deploy` replays the real
 * migration history so the test DB is byte-identical to production.
 *
 * The file is created if it doesn't exist.
 */
export async function applySchemaToTempDb(dbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        const npxCmd = isWindows ? 'npx.cmd' : 'npx';
        const child = spawn(
            npxCmd,
            ['prisma', 'migrate', 'deploy', '--schema', PRISMA_SCHEMA_DIR],
            {
                cwd: SERVER_ROOT,
                env: {
                    ...process.env,
                    DATABASE_URL: `file:${dbPath}`,
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                // On Windows, spawning .cmd shims requires shell: true (CVE-2024-27980).
                shell: isWindows,
            },
        );

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString(); 
        });
        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString(); 
        });

        child.on('error', err => {
            reject(new Error(`Failed to spawn prisma migrate deploy: ${err.message}`));
        });

        child.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(
                    `prisma migrate deploy exited with code ${code}\n` +
                    `stdout: ${stdout}\nstderr: ${stderr}`,
                ));
            }
        });
    });
}

// ── File-based test lock ────────────────────────────────────────────────
// Serializes service-level integration tests that share one SQLite database
// file.  The lock file lives next to the worker source so that every
// service test (regardless of its own subdirectory depth) resolves the
// same physical path.

const TEST_LOCK_PATH = path.join(SERVER_ROOT, 'src', 'worker', '.service-test-db.lock');
const STALE_LOCK_AGE_MS = 5 * 60 * 1000;

/**
 * Acquire an exclusive file-system lock, spinning until available.
 *
 * Stale locks (older than 5 minutes) are automatically reaped so a
 * crashed test run doesn't permanently block future runs.
 */
export async function acquireTestLock(): Promise<void> {
    for (;;) {
        try {
            const handle = await fs.open(TEST_LOCK_PATH, 'wx');
            await handle.writeFile(String(process.pid));
            await handle.close();
            return;
        } catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code !== 'EEXIST') {
                throw err;
            }

            const stats = await fs.stat(TEST_LOCK_PATH).catch(() => null);
            if (stats != null && Date.now() - stats.mtimeMs > STALE_LOCK_AGE_MS) {
                await fs.rm(TEST_LOCK_PATH, { force: true });
                continue;
            }

            await pause(50);
        }
    }
}

/** Release the file-system lock acquired by {@link acquireTestLock}. */
export async function releaseTestLock(): Promise<void> {
    await fs.rm(TEST_LOCK_PATH, { force: true });
}
