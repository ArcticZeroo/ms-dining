/**
 * Backfill script: creates StationMenuSnapshot rows from existing
 * DailyCategory/DailyMenuItem data and populates snapshotId on both
 * DailyStation and DailyCategory.
 *
 * Run AFTER migration `add_station_menu_snapshots` and BEFORE
 * migration `finalize_station_menu_snapshots`.
 *
 * The server must be stopped while this runs. All operations are
 * idempotent — safe to re-run if interrupted.
 *
 * Usage: npx tsx src/adhoc/backfill-snapshots.ts
 */

import { PrismaClient } from '@prisma/client';
import { computeSnapshotHash } from '../shared/util/snapshot-hash.js';

const prisma = new PrismaClient();

interface MenuItemRow {
    dsId: number;
    stationId: string;
    categoryId: number;
    categoryName: string;
    menuItemId: string;
}

interface CategoryInfo {
    categoryId: number;
    menuItemIds: string[];
}

interface DailyStationMenu {
    stationId: string;
    categoriesByName: Map<string, CategoryInfo[]>;
}

const BATCH_SIZE = 500;

async function main() {
    // ── Read phase ──────────────────────────────────────────────────────

    console.log('[Backfill] Reading DailyStation → DailyCategory → DailyMenuItem trees...');

    const rows = await prisma.$queryRaw<MenuItemRow[]>`
        SELECT
            ds.id            AS dsId,
            ds.stationId     AS stationId,
            dc.id            AS categoryId,
            dc.name          AS categoryName,
            dm.menuItemId    AS menuItemId
        FROM DailyStation ds
        JOIN DailyCategory dc ON dc.stationId = ds.id
        JOIN DailyMenuItem dm ON dm.categoryId = dc.id
        ORDER BY ds.id, dc.name, dm.menuItemId
    `;

    console.log(`[Backfill] Read ${rows.length} menu-item rows.`);

    // Group into per-DailyStation structures
    const dailyStationMenus = new Map<number, DailyStationMenu>();

    for (const row of rows) {
        let menu = dailyStationMenus.get(row.dsId);
        if (!menu) {
            menu = { stationId: row.stationId, categoriesByName: new Map() };
            dailyStationMenus.set(row.dsId, menu);
        }

        let categoryInfos = menu.categoriesByName.get(row.categoryName);
        if (!categoryInfos) {
            categoryInfos = [];
            menu.categoriesByName.set(row.categoryName, categoryInfos);
        }

        let categoryInfo = categoryInfos.find(cat => cat.categoryId === row.categoryId);
        if (!categoryInfo) {
            categoryInfo = { categoryId: row.categoryId, menuItemIds: [] };
            categoryInfos.push(categoryInfo);
        }

        categoryInfo.menuItemIds.push(row.menuItemId);
    }

    // Handle DailyStations with no menu items (no categories, or categories with no items)
    const emptyStations = await prisma.$queryRaw<{ id: number; stationId: string }[]>`
        SELECT ds.id, ds.stationId FROM DailyStation ds
        WHERE ds.snapshotId IS NULL
        AND ds.id NOT IN (
            SELECT DISTINCT dc.stationId FROM DailyCategory dc
            JOIN DailyMenuItem dm ON dm.categoryId = dc.id
        )
    `;
    for (const { id, stationId } of emptyStations) {
        dailyStationMenus.set(id, { stationId, categoriesByName: new Map() });
    }

    console.log(`[Backfill] Grouped into ${dailyStationMenus.size} DailyStations (${emptyStations.length} empty).`);

    // Compute hashes and group by unique snapshot
    const dsIdToHash = new Map<number, string>();
    const snapshotRepresentative = new Map<string, { dsId: number; stationId: string }>();

    for (const [dsId, menu] of dailyStationMenus) {
        const menuItemIdsByCategoryName = new Map<string, string[]>();
        for (const [categoryName, categoryInfos] of menu.categoriesByName) {
            menuItemIdsByCategoryName.set(categoryName, categoryInfos.flatMap(cat => cat.menuItemIds));
        }

        const hash = computeSnapshotHash(menu.stationId, menuItemIdsByCategoryName);
        dsIdToHash.set(dsId, hash);

        if (!snapshotRepresentative.has(hash)) {
            snapshotRepresentative.set(hash, { dsId, stationId: menu.stationId });
        }
    }

    console.log(`[Backfill] Computed ${snapshotRepresentative.size} unique snapshots.`);

    // ── Write phase ─────────────────────────────────────────────────────
    // All operations are idempotent. Uses real tables (not TEMP) because
    // Prisma's connection pool doesn't guarantee same-connection for TEMP tables.

    // 1. Create StationMenuSnapshot rows
    console.log('[Backfill] Creating StationMenuSnapshot rows...');
    const snapshotEntries = [...snapshotRepresentative.entries()];
    for (let i = 0; i < snapshotEntries.length; i += BATCH_SIZE) {
        const batch = snapshotEntries.slice(i, i + BATCH_SIZE);
        const values = batch.map(([hash, { stationId }]) => `('${hash}', '${stationId}')`).join(',');
        await prisma.$executeRawUnsafe(
            `INSERT OR IGNORE INTO StationMenuSnapshot (id, stationId) VALUES ${values}`
        );
    }
    console.log(`[Backfill] Created ${snapshotRepresentative.size} snapshot rows.`);

    // 2. Create indexes to speed up the bulk operations
    console.log('[Backfill] Creating helper indexes...');
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS _tmp_dc_stationId ON DailyCategory(stationId)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS _tmp_dc_snapshotId ON DailyCategory(snapshotId)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS _tmp_dm_categoryId ON DailyMenuItem(categoryId)`);

    // 3. Update DailyCategory.snapshotId via a real helper table
    console.log('[Backfill] Updating DailyCategory rows to point at snapshots...');
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS _backfill_rep_map (dsId INTEGER PRIMARY KEY, snapshotId TEXT NOT NULL)`);
    await prisma.$executeRawUnsafe(`DELETE FROM _backfill_rep_map`);
    for (let i = 0; i < snapshotEntries.length; i += BATCH_SIZE) {
        const batch = snapshotEntries.slice(i, i + BATCH_SIZE);
        const values = batch.map(([hash, { dsId }]) => `(${dsId}, '${hash}')`).join(',');
        await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO _backfill_rep_map (dsId, snapshotId) VALUES ${values}`);
    }
    const catUpdated = await prisma.$executeRawUnsafe(`
        UPDATE DailyCategory SET snapshotId = (
            SELECT snapshotId FROM _backfill_rep_map WHERE _backfill_rep_map.dsId = DailyCategory.stationId
        )
        WHERE snapshotId IS NULL AND stationId IN (SELECT dsId FROM _backfill_rep_map)
    `);
    console.log(`[Backfill] Updated ${catUpdated} DailyCategory rows.`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _backfill_rep_map`);

    // 4. Delete duplicate DailyMenuItem rows (batched)
    console.log('[Backfill] Deleting duplicate DailyMenuItem rows...');
    let totalDeletedItems = 0;
    let deleted = 1;
    while (deleted > 0) {
        deleted = await prisma.$executeRawUnsafe(`
            DELETE FROM DailyMenuItem WHERE id IN (
                SELECT dm.id FROM DailyMenuItem dm
                JOIN DailyCategory dc ON dm.categoryId = dc.id
                WHERE dc.snapshotId IS NULL
                LIMIT 50000
            )
        `);
        totalDeletedItems += deleted;
        if (deleted === 0) {
            break; 
        }
        console.log(`[Backfill] Deleted ${totalDeletedItems} duplicate DailyMenuItem rows so far...`);
    }
    console.log(`[Backfill] Deleted ${totalDeletedItems} duplicate DailyMenuItem rows total.`);

    // 5. Delete duplicate DailyCategory rows (batched)
    console.log('[Backfill] Deleting duplicate DailyCategory rows...');
    let totalDeletedCategories = 0;
    deleted = 1;
    while (deleted > 0) {
        deleted = await prisma.$executeRawUnsafe(`
            DELETE FROM DailyCategory WHERE id IN (
                SELECT id FROM DailyCategory WHERE snapshotId IS NULL LIMIT 50000
            )
        `);
        totalDeletedCategories += deleted;
        if (deleted === 0) {
            break; 
        }
        console.log(`[Backfill] Deleted ${totalDeletedCategories} duplicate DailyCategory rows so far...`);
    }
    console.log(`[Backfill] Deleted ${totalDeletedCategories} duplicate DailyCategory rows total.`);

    // 6. Update DailyStation.snapshotId via helper table
    console.log('[Backfill] Updating DailyStation.snapshotId...');
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS _backfill_ds_map (dsId INTEGER PRIMARY KEY, snapshotId TEXT NOT NULL)`);
    await prisma.$executeRawUnsafe(`DELETE FROM _backfill_ds_map`);
    const dsEntries = [...dsIdToHash.entries()];
    for (let i = 0; i < dsEntries.length; i += BATCH_SIZE) {
        const batch = dsEntries.slice(i, i + BATCH_SIZE);
        const values = batch.map(([dsId, hash]) => `(${dsId}, '${hash}')`).join(',');
        await prisma.$executeRawUnsafe(`INSERT INTO _backfill_ds_map (dsId, snapshotId) VALUES ${values}`);
        if ((i + BATCH_SIZE) % 20000 < BATCH_SIZE) {
            console.log(`[Backfill] Prepared ${Math.min(i + BATCH_SIZE, dsEntries.length)}/${dsEntries.length} DailyStation mappings...`);
        }
    }
    const dsUpdated = await prisma.$executeRawUnsafe(`
        UPDATE DailyStation SET snapshotId = (
            SELECT snapshotId FROM _backfill_ds_map WHERE _backfill_ds_map.dsId = DailyStation.id
        )
        WHERE snapshotId IS NULL AND id IN (SELECT dsId FROM _backfill_ds_map)
    `);
    console.log(`[Backfill] Updated ${dsUpdated} DailyStation rows.`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _backfill_ds_map`);

    // 7. Drop helper indexes
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS _tmp_dc_stationId`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS _tmp_dc_snapshotId`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS _tmp_dm_categoryId`);

    // 8. Verify completeness
    const [missingDs] = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM DailyStation WHERE snapshotId IS NULL
    `;
    if (missingDs!.count > 0n) {
        throw new Error(`Backfill incomplete: ${missingDs!.count} DailyStations still have NULL snapshotId`);
    }

    const [missingCat] = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM DailyCategory WHERE snapshotId IS NULL
    `;
    if (missingCat!.count > 0n) {
        throw new Error(`Backfill incomplete: ${missingCat!.count} DailyCategories still have NULL snapshotId`);
    }

    console.log('[Backfill] Verification passed — all rows have snapshotIds.');

    // Print summary
    const [dsCount] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM DailyStation`;
    const [snapCount] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM StationMenuSnapshot`;
    const [finalCatCount] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM DailyCategory`;
    const [itemCount] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM DailyMenuItem`;
    console.log(`[Backfill] Done!`);
    console.log(`  DailyStations:          ${dsCount!.count}`);
    console.log(`  StationMenuSnapshots:   ${snapCount!.count}`);
    console.log(`  DailyCategories:        ${finalCatCount!.count}`);
    console.log(`  DailyMenuItems:         ${itemCount!.count}`);
}

main()
    .catch(err => {
        console.error('[Backfill] FAILED:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
