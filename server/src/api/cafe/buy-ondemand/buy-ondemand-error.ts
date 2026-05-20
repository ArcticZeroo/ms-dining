import { z } from 'zod';
import { logError } from '../../../util/log.js';
import { getServices } from '../../../main/services/registry.js';
import type { BuyOnDemandClient } from './buy-ondemand-client.js';

/**
 * Error thrown when a BuyOnDemand request fails with a translatable error code
 * (e.g. `CONCEPTS_NOT_AVAILABLE` → "Order cannot be processed as the store is
 * currently closed."). The Koa middleware `formatBuyOnDemandErrors` maps these
 * to HTTP 502 responses with `{ message, code }` bodies so the client can show
 * the user-facing message.
 *
 * `super(userMessage)` so callers that read `.message` (logs, generic error
 * handlers) get the translated string by default.
 */
export class BuyOnDemandError extends Error {
    constructor(
        public readonly rawCode: string,
        public readonly userMessage: string,
        public readonly httpStatus: number,
    ) {
        super(userMessage);
        this.name = 'BuyOnDemandError';
    }
}

const bodErrorBodySchema = z.object({
    message: z.string(),
}).passthrough();

/**
 * If `bodyText` parses as a BoD-shape error JSON (`{ message: <code>, ... }`),
 * throws a `BuyOnDemandError` whose `userMessage` is the translated string for
 * that code (or the raw code if translation lookup fails). Returns silently if
 * the body isn't BoD-shape, leaving the caller to handle the generic error.
 *
 * Takes the body as a pre-read string so the caller reads the response body
 * exactly once (Response bodies are single-use).
 */
export async function maybeThrowBuyOnDemandError(
    client: BuyOnDemandClient,
    status: number,
    bodyText: string,
): Promise<void> {
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(bodyText);
    } catch {
        return;
    }

    const parsed = bodErrorBodySchema.safeParse(parsedJson);
    if (!parsed.success) {
        return;
    }

    const rawCode = parsed.data.message;
    let userMessage = rawCode;
    try {
        const translations = await getServices().translations.retrieveAsync(client);
        userMessage = translations.get(rawCode) ?? rawCode;
    } catch (translationErr) {
        // Never block ordering on missing translations. Fall back to the raw
        // code as the user-facing message — better than failing the request
        // outright when the user already hit an upstream error.
        logError(`{${client.cafe.name}} failed to fetch BoD translations, using raw code:`, translationErr);
    }

    throw new BuyOnDemandError(rawCode, userMessage, status);
}
