import { IPriceCafeSummary, IPriceChangeItem, IPriceIncreaseStats, IPricePercentBucket } from '@msdining/common/models/price-history';
import { getPricePairKey } from '@msdining/common/util/price-history';

export interface IPriceComparisonRow {
    menuItemId: string;
    name: string;
    cafeId: string;
    fromAmount: number;
    toAmount: number;
}

export interface IPriceIncreaseStatsOptions {
    /** How many items to keep in each biggest/smallest list. */
    topCount: number;
    /** Items whose "from" price is below this are excluded from %-sorted lists (tiny-base outliers). */
    minBasePriceForPercent: number;
    /** Increases at or below this fraction are treated as unchanged (float noise / rounding). */
    unchangedThresholdPercent: number;
}

export const DEFAULT_STATS_OPTIONS: IPriceIncreaseStatsOptions = {
    topCount:                 15,
    minBasePriceForPercent:   1,
    unchangedThresholdPercent: 0.0001,
};

// Upper edges (as fractions) for the % increase histogram; the final bucket is open-ended.
const PERCENT_BUCKET_UPPER_EDGES = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];

const roundTo = (value: number, places: number): number => {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
};

const toChangeItem = (row: IPriceComparisonRow): IPriceChangeItem => ({
    menuItemId:      row.menuItemId,
    name:            row.name,
    cafeId:          row.cafeId,
    fromAmount:      roundTo(row.fromAmount, 2),
    toAmount:        roundTo(row.toAmount, 2),
    increaseDollars: roundTo(row.toAmount - row.fromAmount, 2),
    increasePercent: row.fromAmount > 0 ? roundTo((row.toAmount - row.fromAmount) / row.fromAmount, 4) : 0,
});

const formatPercentLabel = (fraction: number): string => `${Math.round(fraction * 100)}%`;

const buildDistribution = (increasedItems: IPriceChangeItem[]): IPricePercentBucket[] => {
    const buckets: IPricePercentBucket[] = [];

    let lowerEdge = 0;
    for (const upperEdge of PERCENT_BUCKET_UPPER_EDGES) {
        buckets.push({
            label:      `${formatPercentLabel(lowerEdge)}–${formatPercentLabel(upperEdge)}`,
            minPercent: lowerEdge,
            maxPercent: upperEdge,
            count:      0,
        });
        lowerEdge = upperEdge;
    }
    buckets.push({
        label:      `≥${formatPercentLabel(lowerEdge)}`,
        minPercent: lowerEdge,
        maxPercent: null,
        count:      0,
    });

    for (const item of increasedItems) {
        const bucket = buckets.find(candidate => candidate.maxPercent == null || item.increasePercent < candidate.maxPercent);
        if (bucket != null) {
            bucket.count += 1;
        }
    }

    return buckets;
};

const sumBy = (items: IPriceChangeItem[], selector: (item: IPriceChangeItem) => number): number =>
    items.reduce((total, item) => total + selector(item), 0);

const takeSorted = (
    items: IPriceChangeItem[],
    compare: (a: IPriceChangeItem, b: IPriceChangeItem) => number,
    count: number,
): IPriceChangeItem[] => [...items].sort(compare).slice(0, count);

const buildPerCafeSummaries = (items: IPriceChangeItem[], unchangedThresholdPercent: number): IPriceCafeSummary[] => {
    const itemsByCafe = new Map<string, IPriceChangeItem[]>();
    for (const item of items) {
        const cafeItems = itemsByCafe.get(item.cafeId) ?? [];
        cafeItems.push(item);
        itemsByCafe.set(item.cafeId, cafeItems);
    }

    const summaries: IPriceCafeSummary[] = [];
    for (const [cafeId, cafeItems] of itemsByCafe) {
        const increased = cafeItems.filter(item => item.increasePercent > unchangedThresholdPercent);
        summaries.push({
            cafeId,
            totalItems:             cafeItems.length,
            increasedCount:         increased.length,
            averageIncreasePercent: increased.length > 0 ? roundTo(sumBy(increased, item => item.increasePercent) / increased.length, 4) : 0,
            averageIncreaseDollars: increased.length > 0 ? roundTo(sumBy(increased, item => item.increaseDollars) / increased.length, 2) : 0,
        });
    }

    return summaries.sort((a, b) => b.averageIncreasePercent - a.averageIncreasePercent);
};

/**
 * Aggregates per-item from/to prices into the stats served to the client. Only
 * items that increased contribute to the averages and biggest/smallest lists;
 * %-sorted lists exclude tiny-base items to avoid meaningless outliers.
 */
export const computePriceIncreaseStats = (
    rows: IPriceComparisonRow[],
    fromYear: number,
    toYear: number,
    options: IPriceIncreaseStatsOptions = DEFAULT_STATS_OPTIONS,
): IPriceIncreaseStats => {
    const items = rows.map(toChangeItem);

    const increasedItems = items.filter(item => item.increasePercent > options.unchangedThresholdPercent);
    const decreasedItems = items.filter(item => item.increasePercent < -options.unchangedThresholdPercent);
    const unchangedCount = items.length - increasedItems.length - decreasedItems.length;

    const percentEligible = increasedItems.filter(item => item.fromAmount >= options.minBasePriceForPercent);
    const percentEligibleDecreased = decreasedItems.filter(item => item.fromAmount >= options.minBasePriceForPercent);

    return {
        fromYear,
        toYear,
        totalItems:             items.length,
        increasedCount:         increasedItems.length,
        decreasedCount:         decreasedItems.length,
        unchangedCount,
        increasedFraction:      items.length > 0 ? roundTo(increasedItems.length / items.length, 4) : 0,
        averageIncreaseDollars: increasedItems.length > 0 ? roundTo(sumBy(increasedItems, item => item.increaseDollars) / increasedItems.length, 2) : 0,
        averageIncreasePercent: increasedItems.length > 0 ? roundTo(sumBy(increasedItems, item => item.increasePercent) / increasedItems.length, 4) : 0,
        biggestByDollars:          takeSorted(increasedItems, (a, b) => b.increaseDollars - a.increaseDollars, options.topCount),
        smallestByDollars:         takeSorted(increasedItems, (a, b) => a.increaseDollars - b.increaseDollars, options.topCount),
        biggestByPercent:          takeSorted(percentEligible, (a, b) => b.increasePercent - a.increasePercent, options.topCount),
        smallestByPercent:         takeSorted(percentEligible, (a, b) => a.increasePercent - b.increasePercent, options.topCount),
        biggestDecreasesByDollars: takeSorted(decreasedItems, (a, b) => a.increaseDollars - b.increaseDollars, options.topCount),
        biggestDecreasesByPercent: takeSorted(percentEligibleDecreased, (a, b) => a.increasePercent - b.increasePercent, options.topCount),
        distribution:              buildDistribution(increasedItems),
        perCafe:                   buildPerCafeSummaries(items, options.unchangedThresholdPercent),
    };
};

/**
 * Which fiscal-year pairs to compute: every `from < to` among the available
 * years, so the client can pick any combination without another request.
 */
export const buildComparisonPairs = (availableYears: number[]): Array<{ fromYear: number; toYear: number; key: string }> => {
    const sorted = [...availableYears].sort((a, b) => a - b);
    const pairs: Array<{ fromYear: number; toYear: number; key: string }> = [];

    for (let fromIndex = 0; fromIndex < sorted.length; fromIndex++) {
        for (let toIndex = fromIndex + 1; toIndex < sorted.length; toIndex++) {
            const fromYear = sorted[fromIndex]!;
            const toYear = sorted[toIndex]!;
            pairs.push({ fromYear, toYear, key: getPricePairKey(fromYear, toYear) });
        }
    }

    return pairs;
};
