import * as fs from 'node:fs/promises';
import { IPriceHistoryResponse, PriceHistoryResponseSchema } from '@msdining/common/models/price-history';
import { priceHistoryJsonPath } from '../../../shared/constants/config.js';
import { logError } from '../../../shared/util/log.js';

export const EMPTY_PRICE_HISTORY: IPriceHistoryResponse = {
    generatedAt:    null,
    availableYears: [],
    statsByPair:    {},
    items:          [],
};

/**
 * Reads and validates the generated price-history blob from disk. Returns an
 * empty (but valid) response when the file doesn't exist yet, can't be parsed,
 * or no longer matches the current schema (e.g. an old-shape blob left over
 * after a deploy). This keeps callers from ever seeing a partial/legacy shape,
 * and the boot job treats a null result as "needs regeneration".
 */
export const readValidatedPriceHistoryAsync = async (): Promise<IPriceHistoryResponse | null> => {
    let raw: string;
    try {
        raw = await fs.readFile(priceHistoryJsonPath, 'utf-8');
    } catch {
        return null;
    }

    const parsed = PriceHistoryResponseSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
        logError('[price-history] On-disk blob failed schema validation (will regenerate):', parsed.error.issues);
        return null;
    }

    return parsed.data;
};

/**
 * Like readValidatedPriceHistoryAsync but never null — falls back to an empty
 * response so HTTP callers always get a valid shape.
 */
export const readPriceHistoryFileAsync = async (): Promise<IPriceHistoryResponse> =>
    (await readValidatedPriceHistoryAsync()) ?? EMPTY_PRICE_HISTORY;
