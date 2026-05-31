import { z } from 'zod';
import { logError } from '../util/log.js';
import { getServices } from '../services/registry.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../rpc/errors.js';
import type { BuyOnDemandClient } from './buy-ondemand-client.js';

const bodErrorBodySchema = z.object({
    message: z.string(),
}).passthrough();

/**
 * If `bodyText` parses as a BoD-shape error JSON (`{ message: <code>, ... }`),
 * throws a `ServiceError(UPSTREAM_FAIL)` whose message is the translated string
 * for that code (or the raw code if translation lookup fails). Returns silently
 * if the body isn't BoD-shape, leaving the caller to handle the generic error.
 *
 * Takes the body as a pre-read string so the caller reads the response body
 * exactly once (Response bodies are single-use).
 */
export async function maybeThrowBuyOnDemandError(
    client: BuyOnDemandClient,
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
        const translationMap = await getServices().translations.retrieveAsync(client);
        userMessage = translationMap.get(rawCode) ?? rawCode;
    } catch (translationErr) {
        // Never block ordering on missing translations. Fall back to the raw
        // code as the user-facing message — better than failing the request
        // outright when the user already hit an upstream error.
        logError(`{${client.cafe.name}} failed to fetch BoD translations, using raw code:`, translationErr);
    }

    throw new ServiceError(SERVICE_ERROR_CODES.UPSTREAM_FAIL, userMessage);
}
