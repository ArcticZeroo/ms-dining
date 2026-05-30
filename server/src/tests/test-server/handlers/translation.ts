/**
 * Translation handler: serves the BuyOnDemand i18n endpoint that the production
 * BoD client downloads to translate raw error codes (e.g. `CONCEPTS_NOT_AVAILABLE`)
 * into user-facing messages.
 *
 * Real BoD layers two namespaces:
 *   - `core`               — global ~125 KB shared dictionary
 *   - `domain-<host>`      — tiny per-deploy overrides
 *
 * The test server stores both via TestBuyOnDemandServer.setTranslations(...);
 * tests can mutate either to assert that arbitrary codes flow through the
 * translation pipeline.
 */

import { RouteDefinition, TestRequest, TestResponse, ITestServerState } from '../models.js';

function handleTranslation(req: TestRequest, state: ITestServerState): TestResponse {
    const namespace = req.params?.namespace ?? '';

    return {
        status: 200,
        body: state.getTranslations(namespace),
    };
}

export const translationRoutes: RouteDefinition[] = [
    {
        method: 'GET',
        // Trailing slash is part of the real BoD URL.
        pattern: '/translation/language/:locale/ns/:namespace/',
        handler: handleTranslation,
    },
];
