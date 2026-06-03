import { createHash } from 'node:crypto';

/**
 * Compute a deterministic SHA-256 hash for a station's menu content.
 *
 * The hash encodes `stationId` + sorted category names + sorted menuItemIds
 * within each category. Two stations with the same menu content produce the
 * same hash; different stationIds always produce different hashes.
 *
 * No duplicate category names exist per station in production data (verified).
 */
export const computeSnapshotHash = (
    stationId: string,
    menuItemIdsByCategoryName: Map<string, Array<string>>,
): string => {
    const sortedCategories = [...menuItemIdsByCategoryName.entries()]
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));

    const parts: string[] = [stationId];
    for (const [categoryName, menuItemIds] of sortedCategories) {
        const sortedIds = [...menuItemIds].sort();
        parts.push(`${categoryName}:${sortedIds.join(',')}`);
    }

    return createHash('sha256').update(parts.join('|')).digest('hex');
};
