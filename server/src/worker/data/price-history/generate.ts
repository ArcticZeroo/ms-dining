import * as fs from 'node:fs/promises';
import { IPriceHistoryItem, IPriceHistoryResponse, IPriceIncreaseStats } from '@msdining/common/models/price-history';
import { priceHistoryJsonPath, serverDataPath } from '../../../shared/constants/config.js';
import { logError, logInfo } from '../../../shared/util/log.js';
import { buildComparisonPairs, computePriceIncreaseStats, IPriceComparisonRow } from './compute.js';
import { fetchAllCafePriceLevelsAsync, IItemPriceLevels } from './fetch.js';
import { retrieveFiscalPresenceAsync } from './presence.js';

type PresenceByItemId = Map<string, Set<number>>;

// A fiscal year is offered only if some item has a price for it AND we have
// snapshot coverage proving items were on the menu that year.
const computeAvailableYears = (priceItems: IItemPriceLevels[], presenceByItemId: PresenceByItemId): number[] => {
    const priceYears = new Set<number>();
    for (const item of priceItems) {
        for (const year of item.amountByFiscalYear.keys()) {
            priceYears.add(year);
        }
    }

    const presenceYears = new Set<number>();
    for (const years of presenceByItemId.values()) {
        for (const year of years) {
            presenceYears.add(year);
        }
    }

    return Array.from(priceYears)
        .filter(year => presenceYears.has(year))
        .sort((a, b) => a - b);
};

const buildRowsForPair = (
    priceItems: IItemPriceLevels[],
    presenceByItemId: PresenceByItemId,
    fromYear: number,
    toYear: number,
): IPriceComparisonRow[] => {
    const rows: IPriceComparisonRow[] = [];

    for (const item of priceItems) {
        const fromAmount = item.amountByFiscalYear.get(fromYear);
        const toAmount = item.amountByFiscalYear.get(toYear);
        if (fromAmount == null || toAmount == null) {
            continue;
        }

        const presence = presenceByItemId.get(item.menuItemId);
        if (presence == null || !presence.has(fromYear) || !presence.has(toYear)) {
            continue;
        }

        rows.push({
            menuItemId: item.menuItemId,
            name:       item.name,
            cafeId:     item.cafeId,
            fromAmount,
            toAmount,
        });
    }

    return rows;
};

export const buildPriceHistoryResponse = (
    priceItems: IItemPriceLevels[],
    presenceByItemId: PresenceByItemId,
): IPriceHistoryResponse => {
    const availableYears = computeAvailableYears(priceItems, presenceByItemId);

    const statsByPair: Record<string, IPriceIncreaseStats> = {};
    for (const { fromYear, toYear, key } of buildComparisonPairs(availableYears)) {
        const rows = buildRowsForPair(priceItems, presenceByItemId, fromYear, toYear);
        statsByPair[key] = computePriceIncreaseStats(rows, fromYear, toYear);
    }

    return {
        generatedAt: new Date().toISOString(),
        availableYears,
        statsByPair,
        items:       buildItems(priceItems, presenceByItemId),
    };
};

// Flat item catalog for client-side search. Only items with snapshot presence
// are included, since an item with no presence can't form any valid comparison.
const buildItems = (priceItems: IItemPriceLevels[], presenceByItemId: PresenceByItemId): IPriceHistoryItem[] => {
    const items: IPriceHistoryItem[] = [];

    for (const item of priceItems) {
        const presence = presenceByItemId.get(item.menuItemId);
        if (presence == null || presence.size === 0) {
            continue;
        }

        items.push({
            menuItemId:   item.menuItemId,
            name:         item.name,
            cafeId:       item.cafeId,
            pricesByYear: Object.fromEntries(item.amountByFiscalYear),
            presentYears: Array.from(presence).sort((a, b) => a - b),
        });
    }

    return items;
};

const writePriceHistoryAtomicAsync = async (response: IPriceHistoryResponse): Promise<void> => {
    await fs.mkdir(serverDataPath, { recursive: true });
    // Temp file in the same directory so rename() stays on one filesystem (atomic).
    const tempPath = `${priceHistoryJsonPath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(response));
    await fs.rename(tempPath, priceHistoryJsonPath);
};

// Synchronous guard so overlapping cron/boot triggers can't run concurrently.
let isGenerating = false;

/**
 * Computes the full price-history analysis (all fiscal-year pairs) and writes it
 * to the data directory. Safe to call from multiple triggers — overlapping
 * calls are skipped.
 */
export const generatePriceHistoryAsync = async (): Promise<IPriceHistoryResponse | null> => {
    if (isGenerating) {
        logInfo('[price-history] Generation already in progress, skipping');
        return null;
    }

    isGenerating = true;
    try {
        logInfo('[price-history] Generating price history...');

        const [priceItems, presenceByItemId] = await Promise.all([
            fetchAllCafePriceLevelsAsync(),
            retrieveFiscalPresenceAsync(),
        ]);

        const response = buildPriceHistoryResponse(priceItems, presenceByItemId);
        await writePriceHistoryAtomicAsync(response);

        logInfo(`[price-history] Wrote ${Object.keys(response.statsByPair).length} pair(s) for fiscal years ${response.availableYears.join(', ') || '(none)'}`);
        return response;
    } catch (error) {
        logError('[price-history] Failed to generate price history:', error);
        return null;
    } finally {
        isGenerating = false;
    }
};
