import { getMenuItemFiscalPresence } from '@prisma/client/sql';
import { usePrismaClient } from '../storage/client.js';

/**
 * Map of menuItemId -> set of fiscal years the item appeared on any menu,
 * derived from the daily snapshot history. Used to require that an item was
 * actually on the menu in both fiscal windows of a comparison.
 */
export const retrieveFiscalPresenceAsync = async (): Promise<Map<string, Set<number>>> => {
    const rows = await usePrismaClient(client => client.$queryRawTyped(getMenuItemFiscalPresence()));

    const presenceByItemId = new Map<string, Set<number>>();
    for (const row of rows) {
        if (row.menuItemId == null || row.fiscalYear == null) {
            continue;
        }

        const years = presenceByItemId.get(row.menuItemId) ?? new Set<number>();
        years.add(Number(row.fiscalYear));
        presenceByItemId.set(row.menuItemId, years);
    }

    return presenceByItemId;
};
