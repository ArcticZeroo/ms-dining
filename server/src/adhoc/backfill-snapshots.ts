/**
 * Backfill script: creates StationMenuSnapshot rows from existing
 * DailyCategory/DailyMenuItem data and populates snapshotId on both
 * DailyStation and DailyCategory.
 *
 * Run AFTER migration `add_station_menu_snapshots` and BEFORE
 * migration `finalize_station_menu_snapshots`.
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

async function main() {
    // ── Read phase (outside transaction) ────────────────────────────────

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
    // Track which categoryIds belong to which DailyStation
    const categoryIdToDsId = new Map<number, number>();

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

        let categoryInfo = categoryInfos.find(c => c.categoryId === row.categoryId);
        if (!categoryInfo) {
            categoryInfo = { categoryId: row.categoryId, menuItemIds: [] };
            categoryInfos.push(categoryInfo);
        }

        categoryInfo.menuItemIds.push(row.menuItemId);
        categoryIdToDsId.set(row.categoryId, row.dsId);
    }

    // Handle DailyStations with no menu items (either no categories, or
    // categories that have no items). These were missed by the inner join above.
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
    // For each unique hash, pick the first DailyStation as the representative
    // (its DailyCategory/DailyMenuItem rows will be kept; duplicates deleted)
    const snapshotRepresentative = new Map<string, { dsId: number; stationId: string }>();
    const snapshotDsIds = new Map<string, number[]>();

    for (const [dsId, menu] of dailyStationMenus) {
        // Build the Map<categoryName, menuItemIds[]> for hashing
        const menuItemIdsByCategoryName = new Map<string, string[]>();
        for (const [categoryName, categoryInfos] of menu.categoriesByName) {
            const allItemIds = categoryInfos.flatMap(c => c.menuItemIds);
            menuItemIdsByCategoryName.set(categoryName, allItemIds);
        }

        const hash = computeSnapshotHash(menu.stationId, menuItemIdsByCategoryName);
        dsIdToHash.set(dsId, hash);

        if (!snapshotRepresentative.has(hash)) {
            snapshotRepresentative.set(hash, { dsId, stationId: menu.stationId });
            snapshotDsIds.set(hash, []);
        }
        snapshotDsIds.get(hash)!.push(dsId);
    }

    console.log(`[Backfill] Computed ${snapshotRepresentative.size} unique snapshots.`);

    // ── Write phase (single transaction) ────────────────────────────────

    const BATCH_SIZE = 500;

    console.log('[Backfill] Writing snapshots and updating rows in a transaction...');

    // Use raw SQLite transaction for better performance on bulk operations.
    // Prisma interactive transactions have timeouts and overhead we don't need.
    await prisma.$executeRaw`PRAGMA foreign_keys = OFF`;
    await prisma.$executeRaw`BEGIN`;

    try {
        // 1. Create StationMenuSnapshot rows
        const snapshotValues = [...snapshotRepresentative.entries()]
            .map(([hash, { stationId }]) => `('${hash}', '${stationId}')`)
            .join(',');
        await prisma.$executeRawUnsafe(
            `INSERT OR IGNORE INTO StationMenuSnapshot (id, stationId) VALUES ${snapshotValues}`
        );
        console.log(`[Backfill] Created ${snapshotRepresentative.size} snapshot rows.`);

        // 2. Update representative DailyCategory rows to point at their snapshot.
        //    Build a temp table mapping old DailyStation.id → snapshot hash for the
        //    representative DailyStations, then bulk-update.
        await prisma.$executeRaw`
            CREATE TEMP TABLE _rep_map (dsId INTEGER PRIMARY KEY, snapshotId TEXT NOT NULL)
        `;
        const repEntries = [...snapshotRepresentative.entries()];
        for (let i = 0; i < repEntries.length; i += BATCH_SIZE) {
            const batch = repEntries.slice(i, i + BATCH_SIZE);
            const values = batch.map(([hash, { dsId }]) => `(${dsId}, '${hash}')`).join(',');
            await prisma.$executeRawUnsafe(
                `INSERT INTO _rep_map (dsId, snapshotId) VALUES ${values}`
            );
        }

        const categoryUpdateCount = await prisma.$executeRaw`
            UPDATE DailyCategory SET snapshotId = (
                SELECT snapshotId FROM _rep_map WHERE _rep_map.dsId = DailyCategory.stationId
            )
            WHERE stationId IN (SELECT dsId FROM _rep_map)
        `;
        console.log(`[Backfill] Updated ${categoryUpdateCount} DailyCategory rows to point at snapshots.`);

        // 3. Delete duplicate DailyMenuItem rows (those whose category has no snapshot)
        const deletedItems = await prisma.$executeRaw`
            DELETE FROM DailyMenuItem WHERE categoryId IN (
                SELECT id FROM DailyCategory WHERE snapshotId IS NULL
            )
        `;
        console.log(`[Backfill] Deleted ${deletedItems} duplicate DailyMenuItem rows.`);

        // 4. Delete duplicate DailyCategory rows
        const deletedCategories = await prisma.$executeRaw`
            DELETE FROM DailyCategory WHERE snapshotId IS NULL
        `;
        console.log(`[Backfill] Deleted ${deletedCategories} duplicate DailyCategory rows.`);

        // 5. Bulk-update DailyStation.snapshotId using a temp table
        await prisma.$executeRaw`
            CREATE TEMP TABLE _ds_map (dsId INTEGER PRIMARY KEY, snapshotId TEXT NOT NULL)
        `;
        const entries = [...dsIdToHash.entries()];
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);
            const values = batch.map(([dsId, hash]) => `(${dsId}, '${hash}')`).join(',');
            await prisma.$executeRawUnsafe(
                `INSERT INTO _ds_map (dsId, snapshotId) VALUES ${values}`
            );
            if ((i + BATCH_SIZE) % 20000 < BATCH_SIZE) {
                console.log(`[Backfill] Prepared ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length} DailyStation mappings...`);
            }
        }

        const dsUpdated = await prisma.$executeRaw`
            UPDATE DailyStation SET snapshotId = (
                SELECT snapshotId FROM _ds_map WHERE _ds_map.dsId = DailyStation.id
            )
            WHERE id IN (SELECT dsId FROM _ds_map)
        `;
        console.log(`[Backfill] Updated ${dsUpdated} DailyStation rows with snapshotIds.`);

        // 6. Verify completeness
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

        await prisma.$executeRaw`DROP TABLE IF EXISTS _rep_map`;
        await prisma.$executeRaw`DROP TABLE IF EXISTS _ds_map`;
        await prisma.$executeRaw`COMMIT`;
    } catch (err) {
        await prisma.$executeRaw`ROLLBACK`;
        throw err;
    } finally {
        await prisma.$executeRaw`PRAGMA foreign_keys = ON`;
    }

    // Print summary
    const [dsCount] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM DailyStation`;
    const [snapCount] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM StationMenuSnapshot`;
    const [catCount] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM DailyCategory`;
    const [itemCount] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM DailyMenuItem`;
    console.log(`[Backfill] Done!`);
    console.log(`  DailyStations:          ${dsCount!.count}`);
    console.log(`  StationMenuSnapshots:   ${snapCount!.count}`);
    console.log(`  DailyCategories:        ${catCount!.count}`);
    console.log(`  DailyMenuItems:         ${itemCount!.count}`);
}

main()
    .catch(err => {
        console.error('[Backfill] FAILED:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
