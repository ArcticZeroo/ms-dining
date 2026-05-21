/**
 * Production preflight smoke check.
 *
 * Runs as a separate process before the main server boots (see
 * `npm run start` / `npm run deploy`). Purpose: catch misconfigurations
 * — wrong DATABASE_URL path, missing schema, empty/fresh DB — BEFORE
 * the server opens write handles or accepts traffic.
 *
 * Failure modes this protects against:
 *   - `.env` DATABASE_URL points at a relative path that resolves differently
 *     than expected from the cwd (this script prints the resolved absolute
 *     path on failure so the operator immediately sees where it looked).
 *   - Schema not pushed yet (`no such table: main.RuntimeMigration`).
 *   - DB exists but is empty (potential sign of pointing at a fresh file
 *     instead of the populated prod DB).
 *
 * Exit codes:
 *   0  All checks passed.
 *   1  Schema / connectivity / file-path problem. Server MUST NOT start.
 *   2  Tables present but one or more is empty. Use --allow-empty (or
 *      PREFLIGHT_ALLOW_EMPTY=1) to acknowledge that a fresh DB is expected
 *      (e.g. first-time deploy, dev clone before sync) and proceed.
 *
 * Usage:
 *   node dist/preflight.js              — full check, exits non-zero on failure
 *   node dist/preflight.js --allow-empty — skip the "must be non-empty" check
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './shared/util/database-url.js';

dotenv.config();

const ALLOW_EMPTY_FLAG = '--allow-empty';
const ALLOW_EMPTY_ENV  = 'PREFLIGHT_ALLOW_EMPTY';

const log  = (msg: string) => console.log(`[preflight] ${msg}`);
const fail = (msg: string, exitCode: number): never => {
    console.error(`[preflight] FAIL: ${msg}`);
    process.exit(exitCode);
};

/**
 * Extracts the absolute filesystem path from a resolved DATABASE_URL
 * for stat/existence checks. Returns null for non-file URLs.
 */
function resolveDbPath(databaseUrl: string): string | null {
    const resolved = resolveDatabaseUrl(databaseUrl);
    if (!resolved.startsWith('file:')) return null;
    return resolved.slice('file:'.length);
}

/**
 * One read-only sanity query per major prod table the server hits on first
 * request. `findFirst()` returns null on empty tables (not an error) — only
 * a missing table or connectivity failure throws here.
 */
async function readEachTable(prisma: PrismaClient): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    counts.RuntimeMigration = await prisma.runtimeMigration.count();
    counts.Cafe             = await prisma.cafe.count();
    counts.Station          = await prisma.station.count();
    counts.MenuItem         = await prisma.menuItem.count();
    counts.DailyCafe        = await prisma.dailyCafe.count();
    counts.DailyStation     = await prisma.dailyStation.count();
    counts.DailyMenuItem    = await prisma.dailyMenuItem.count();
    counts.MenuItemTag      = await prisma.menuItemTag.count();
    counts.User             = await prisma.user.count();
    return counts;
}

async function main(): Promise<void> {
    const allowEmpty = process.argv.includes(ALLOW_EMPTY_FLAG)
        || process.env[ALLOW_EMPTY_ENV] === '1';

    const databaseUrl = process.env.DATABASE_URL;
    log(`DATABASE_URL=${databaseUrl ?? '<unset>'}`);
    log(`cwd=${process.cwd()}`);

    if (databaseUrl == null || databaseUrl.length === 0) {
        fail('DATABASE_URL environment variable is not set.', 1);
        return; // unreachable; satisfies TS narrowing
    }

    const resolvedPath = resolveDbPath(databaseUrl);
    if (resolvedPath != null) {
        log(`Resolved DB path: ${resolvedPath}`);
        if (!fs.existsSync(resolvedPath)) {
            fail(`Database file does not exist at the resolved path. Check DATABASE_URL and the cwd you invoked from.`, 1);
        }
        const stat = fs.statSync(resolvedPath);
        log(`File size: ${stat.size.toLocaleString()} bytes`);
    } else {
        log('Non-file:// DATABASE_URL detected; skipping path-existence check.');
    }

    const resolvedUrl = resolveDatabaseUrl(databaseUrl);
    const adapter = new PrismaLibSql(
        { url: resolvedUrl },
        { timestampFormat: 'unixepoch-ms' },
    );
    const prisma = new PrismaClient({ adapter });

    let counts: Record<string, number> = {};
    let readErr: unknown;
    try {
        counts = await readEachTable(prisma);
    } catch (err) {
        readErr = err;
    }

    await prisma.$disconnect().catch(() => {});

    if (readErr != null) {
        const errorMessage = readErr instanceof Error ? readErr.message : String(readErr);
        fail(`Read-only sanity query failed: ${errorMessage}`, 1);
    }

    log('Table counts:');
    for (const [table, count] of Object.entries(counts)) {
        log(`  ${table.padEnd(20)} ${count.toLocaleString()}`);
    }

    const emptyTables = Object.entries(counts)
        .filter(([, count]) => count === 0)
        .map(([table]) => table);

    if (emptyTables.length > 0 && !allowEmpty) {
        fail(
            `${emptyTables.length} table(s) are empty: ${emptyTables.join(', ')}. `
            + `If this DB is intentionally fresh, re-run with --allow-empty (or set ${ALLOW_EMPTY_ENV}=1).`,
            2,
        );
    }

    if (emptyTables.length > 0) {
        log(`OK (with ${emptyTables.length} empty table(s), --allow-empty acknowledged)`);
    } else {
        log('OK');
    }
}

// Ensure this only runs when invoked directly, not when imported (e.g. by tests).
const isDirectInvocation = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '');
if (isDirectInvocation) {
    main().catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        fail(`Unexpected preflight failure: ${errorMessage}`, 1);
    });
}
