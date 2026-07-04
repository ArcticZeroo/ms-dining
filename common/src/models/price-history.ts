import { z } from 'zod';

export const PriceChangeItemSchema = z.object({
	menuItemId:      z.string(),
	name:            z.string(),
	cafeId:          z.string(),
	fromAmount:      z.number(),
	toAmount:        z.number(),
	increaseDollars: z.number(),
	/** Fraction, e.g. 0.079 for a 7.9% increase. */
	increasePercent: z.number(),
});

export type IPriceChangeItem = z.infer<typeof PriceChangeItemSchema>;

export const PricePercentBucketSchema = z.object({
	label:      z.string(),
	/** Inclusive lower bound as a fraction (e.g. 0.05 for 5%). */
	minPercent: z.number(),
	/** Exclusive upper bound as a fraction, or null for the open-ended top bucket. */
	maxPercent: z.number().nullable(),
	count:      z.number(),
});

export type IPricePercentBucket = z.infer<typeof PricePercentBucketSchema>;

export const PriceCafeSummarySchema = z.object({
	cafeId:                 z.string(),
	/** Items present in both fiscal windows for this cafe. */
	totalItems:             z.number(),
	increasedCount:         z.number(),
	/** Averages over items that increased at this cafe. */
	averageIncreasePercent: z.number(),
	averageIncreaseDollars: z.number(),
});

export type IPriceCafeSummary = z.infer<typeof PriceCafeSummarySchema>;

export const PriceIncreaseStatsSchema = z.object({
	fromYear:               z.number(),
	toYear:                 z.number(),
	/** Items present on the menu in both fiscal windows with a price in both years. */
	totalItems:             z.number(),
	increasedCount:         z.number(),
	decreasedCount:         z.number(),
	unchangedCount:         z.number(),
	/** increasedCount / totalItems (0 when totalItems is 0). */
	increasedFraction:      z.number(),
	/** Averages are computed over items that increased only (0 when none increased). */
	averageIncreaseDollars: z.number(),
	averageIncreasePercent: z.number(),
	biggestByDollars:       z.array(PriceChangeItemSchema),
	biggestByPercent:       z.array(PriceChangeItemSchema),
	smallestByDollars:      z.array(PriceChangeItemSchema),
	smallestByPercent:      z.array(PriceChangeItemSchema),
	/** Largest decreases (most negative), among items that decreased. */
	biggestDecreasesByDollars: z.array(PriceChangeItemSchema),
	biggestDecreasesByPercent: z.array(PriceChangeItemSchema),
	distribution:           z.array(PricePercentBucketSchema),
	/** Per-cafe breakdown, sorted by average percent increase descending. */
	perCafe:                z.array(PriceCafeSummarySchema),
});

export type IPriceIncreaseStats = z.infer<typeof PriceIncreaseStatsSchema>;

/**
 * A single item's full price history, used for client-side search across every
 * comparison. Change for a given pair is derived via getItemChangeForPair.
 */
export const PriceHistoryItemSchema = z.object({
	menuItemId:   z.string(),
	name:         z.string(),
	cafeId:       z.string(),
	/** Fiscal year -> amount. JSON object keys are strings. */
	pricesByYear: z.record(z.string(), z.number()),
	/** Fiscal years the item was on the menu, ascending. */
	presentYears: z.array(z.number()),
});

export type IPriceHistoryItem = z.infer<typeof PriceHistoryItemSchema>;

export const PriceHistoryResponseSchema = z.object({
	/** ISO timestamp of when the analysis was generated, or null if never generated. */
	generatedAt:    z.string().nullable(),
	/** Fiscal years selectable for comparison, ascending. */
	availableYears: z.array(z.number()),
	/** Keyed by `${fromYear}-${toYear}` (see getPricePairKey). */
	statsByPair:    z.record(z.string(), PriceIncreaseStatsSchema),
	/** Full item catalog for client-side search. */
	items:          z.array(PriceHistoryItemSchema),
});

export type IPriceHistoryResponse = z.infer<typeof PriceHistoryResponseSchema>;
