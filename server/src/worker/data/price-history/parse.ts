import { ICafeMenuItemPriceLevelData } from '../../../shared/models/buyondemand/responses.js';

const MS_FISCAL_YEAR_PATTERN = /^MS_(\d{4})$/;

/**
 * Extracts the historical price-by-fiscal-year map from a BoD item's
 * `priceLevels`. Matches only real `MS_<year>` levels (skips `Base Price` and
 * Atlanta `MS_ATL_*` levels), keyed by the year in the level's `name` rather
 * than its numeric id (which changes each year). `amount` is a string in the
 * BoD payload, so it is parsed and only kept when finite and positive.
 */
export const parsePriceLevels = (item: { priceLevels?: Record<string, ICafeMenuItemPriceLevelData> | null }): Map<number, number> => {
    const amountByFiscalYear = new Map<number, number>();

    const priceLevels = item.priceLevels;
    if (priceLevels == null) {
        return amountByFiscalYear;
    }

    for (const level of Object.values(priceLevels)) {
        const match = MS_FISCAL_YEAR_PATTERN.exec(level?.name ?? '');
        if (match == null) {
            continue;
        }

        const fiscalYear = Number(match[1]);
        const amount = Number(level.price?.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            continue;
        }

        amountByFiscalYear.set(fiscalYear, amount);
    }

    return amountByFiscalYear;
};
