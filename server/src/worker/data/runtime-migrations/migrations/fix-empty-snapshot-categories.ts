import { IRuntimeMigration } from '../types.js';
import { usePrismaClient, usePrismaTransaction } from '../../storage/client.js';
import { computeSnapshotHash } from '../../../../shared/util/snapshot-hash.js';
import { logInfo } from '../../../../shared/util/log.js';

/**
 * The snapshot backfill script preserved empty DailyCategory rows
 * (categories with no DailyMenuItem children) because it updated
 * ALL categories for the representative DailyStation without filtering.
 *
 * These empty categories make the snapshot hash wrong (the hash now
 * excludes empty categories). This migration:
 *   1. Finds snapshots containing empty categories
 *   2. Computes the correct hash (without empty categories)
 *   3. Gets or creates the correct snapshot
 *   4. Repoints all DailyStations from the old snapshot to the correct one
 *   5. Deletes the old snapshot (cascade-deletes its categories)
 *
 * Processes one snapshot per transaction so this can run in the background.
 */
export const fixEmptySnapshotCategories: IRuntimeMigration = {
    name:        'fix-empty-snapshot-categories',
    description: 'Rehash snapshots that contain empty categories from the backfill',
    runMode:     'background',
    async run() {
        // Find all snapshots that have at least one empty category
        const badSnapshots = await usePrismaClient(prisma => prisma.stationMenuSnapshot.findMany({
            where: {
                categories: {
                    some: {
                        menuItems: { none: {} },
                    },
                },
            },
            select: {
                id:        true,
                stationId: true,
            },
        }));

        logInfo(`[Migration:FixEmptyCategories] Found ${badSnapshots.length} snapshots with empty categories.`);

        let fixed = 0;
        // Process each bad snapshot in its own transaction - allows the migration to be background since we yield
        // to other things between transactions. Worst case, we end up with orphaned snapshots which isn't a major issue.
        for (const { id: oldSnapshotId, stationId } of badSnapshots) {
            await usePrismaTransaction(async (prisma) => {
                // Load the non-empty categories for this snapshot to recompute hash
                const categories = await prisma.dailyCategory.findMany({
                    where: {
                        snapshotId: oldSnapshotId,
                        menuItems:  { some: {} },
                    },
                    select: {
                        name:      true,
                        menuItems: { select: { menuItemId: true } },
                    },
                });

                // Compute the correct hash (without empty categories)
                const menuItemIdsByCategoryName = new Map<string, string[]>();
                for (const category of categories) {
                    menuItemIdsByCategoryName.set(
                        category.name,
                        category.menuItems.map(item => item.menuItemId),
                    );
                }
                const correctHash = computeSnapshotHash(stationId, menuItemIdsByCategoryName);

                if (correctHash === oldSnapshotId) {
                    // Hash didn't change (shouldn't happen, but be safe)
                    // Just delete the empty categories
                    await prisma.dailyCategory.deleteMany({
                        where: {
                            snapshotId: oldSnapshotId,
                            menuItems:  { none: {} },
                        },
                    });
                    return;
                }

                // Get or create the correct snapshot
                const existing = await prisma.stationMenuSnapshot.findUnique({
                    where:  { id: correctHash },
                    select: { id: true },
                });

                if (existing == null) {
                    await prisma.stationMenuSnapshot.create({
                        data: {
                            id:        correctHash,
                            stationId,
                            categories: {
                                create: categories.map(category => ({
                                    name:      category.name,
                                    menuItems: {
                                        create: category.menuItems.map(item => ({
                                            menuItemId: item.menuItemId,
                                        })),
                                    },
                                })),
                            },
                        },
                    });
                }

                // Repoint all DailyStations from old snapshot to correct one
                await prisma.dailyStation.updateMany({
                    where:  { snapshotId: oldSnapshotId },
                    data:   { snapshotId: correctHash },
                });

                // Delete the old snapshot (cascade-deletes its categories + items)
                await prisma.stationMenuSnapshot.delete({
                    where: { id: oldSnapshotId },
                });
            });

            fixed++;
            if (fixed % 50 === 0) {
                logInfo(`[Migration:FixEmptyCategories] Fixed ${fixed}/${badSnapshots.length} snapshots...`);
            }
        }

        logInfo(`[Migration:FixEmptyCategories] Fixed ${fixed} snapshots total.`);
    },
};
