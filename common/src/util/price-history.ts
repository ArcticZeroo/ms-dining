/**
 * Stable key for a (fromYear, toYear) comparison used in
 * IPriceHistoryResponse.statsByPair. Shared by the generator and the client so
 * the two never drift.
 */
export const getPricePairKey = (fromYear: number, toYear: number): string => `${fromYear}-${toYear}`;

/**
 * The fiscal year a menu-snapshot date belongs to. BoD price levels (MS_<year>)
 * take effect on July 1 of that calendar year, so July–December belong to the
 * current year and January–June belong to the previous year.
 *
 * @param dateString A `YYYY-MM-DD` snapshot date.
 */
export const fiscalYearForDateString = (dateString: string): number => {
	const year = Number(dateString.slice(0, 4));
	const month = Number(dateString.slice(5, 7));
	return month >= 7 ? year : year - 1;
};

export interface IPriceItemChange {
	fromAmount: number;
	toAmount: number;
	increaseDollars: number;
	/** Fraction, e.g. 0.079 for a 7.9% increase. */
	increasePercent: number;
}

const roundTo = (value: number, places: number): number => {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
};

/**
 * Derives an item's price change for a specific fiscal-year pair. Returns null
 * when the item has no price for one of the years or wasn't on the menu in both
 * fiscal windows — the same validity rule the aggregate stats use.
 */
export const getItemChangeForPair = (
	item: { pricesByYear: Record<string, number>; presentYears: number[] },
	fromYear: number,
	toYear: number,
): IPriceItemChange | null => {
	const fromAmount = item.pricesByYear[fromYear];
	const toAmount = item.pricesByYear[toYear];
	if (fromAmount == null || toAmount == null) {
		return null;
	}

	if (!item.presentYears.includes(fromYear) || !item.presentYears.includes(toYear)) {
		return null;
	}

	return {
		fromAmount,
		toAmount,
		increaseDollars: roundTo(toAmount - fromAmount, 2),
		increasePercent: fromAmount > 0 ? roundTo((toAmount - fromAmount) / fromAmount, 4) : 0,
	};
};
