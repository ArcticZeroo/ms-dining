/**
 * Helpers for managing per-test SQLite databases.
 *
 * `applySchemaToTempDb(dbPath)` runs `prisma db push` against the given path,
 * producing an empty, migrated SQLite database that can be opened by the
 * PrismaClient when DATABASE_URL points at it.
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the server root (containing prisma/ and node_modules/) once.
// __dirname points at server/src/test-server, so go up two levels.
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const PRISMA_SCHEMA_DIR = path.join(SERVER_ROOT, 'prisma');

/**
 * Apply the production Prisma schema to a fresh SQLite database file.
 *
 * Uses `prisma db push` (rather than `prisma migrate deploy`) because:
 *   - We start from an empty file every time, so the migration history isn't
 *     useful.
 *   - `db push` is faster — it diffs schema vs DB once instead of replaying
 *     each migration sequentially.
 *
 * The file is created if it doesn't exist. If it does exist, its schema is
 * synced to match the production schema.
 */
export async function applySchemaToTempDb(dbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        const npxCmd = isWindows ? 'npx.cmd' : 'npx';
        const child = spawn(
            npxCmd,
            ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', PRISMA_SCHEMA_DIR],
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
        child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

        child.on('error', err => {
            reject(new Error(`Failed to spawn prisma db push: ${err.message}`));
        });

        child.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(
                    `prisma db push exited with code ${code}\n` +
                    `stdout: ${stdout}\nstderr: ${stderr}`,
                ));
            }
        });
    });
}
