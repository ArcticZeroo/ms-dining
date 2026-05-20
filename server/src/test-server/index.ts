/**
 * TestBuyOnDemandServer: In-memory mock server for the BuyOnDemand API.
 *
 * Instead of running a real HTTP server, this class acts as a request router
 * that processes requests synchronously in-memory. TestBuyOnDemandClient
 * calls handleRequest() instead of fetch().
 */

import {
    TestRequest,
    TestResponse,
    RouteDefinition,
    RouteHandler,
    MatchedRoute,
    RouteParams,
    FailureRule,
    DelayRule,
    RequestLogEntry,
    OrderState,
    ITestServerState,
    CafeFixtureSummary,
    FixtureSummary,
} from './models.js';
import { ServerState } from './state.js';
import { authRoutes } from './handlers/auth.js';
import { stationRoutes } from './handlers/stations.js';
import { menuItemRoutes } from './handlers/menu-items.js';
import { orderingRoutes } from './handlers/ordering.js';
import { paymentRoutes } from './handlers/payment.js';
import { translationRoutes } from './handlers/translation.js';
import { getServices } from '../main/services/registry.js';

function pathPatternToRegex(pattern: string): RegExp {
    // Convert '/sites/:tenantId/:contextId/concepts/:displayProfileId'
    // to a regex like /^\/sites\/([^/]+)\/([^/]+)\/concepts\/([^/]+)$/
    const paramNames: string[] = [];
    const regexStr = pattern
        .replace(/:[a-zA-Z]+/g, (match) => {
            paramNames.push(match.slice(1));
            return '([^/]+)';
        })
        .replace(/\//g, '\\/');

    return new RegExp(`^${regexStr}$`);
}

interface CompiledRoute {
    method: string;
    regex: RegExp;
    paramNames: string[];
    handler: RouteHandler;
}

function compileRoute(route: RouteDefinition): CompiledRoute {
    const paramNames: string[] = [];
    const regexStr = route.pattern
        .replace(/:[a-zA-Z]+/g, (match) => {
            paramNames.push(match.slice(1));
            return '([^/]+)';
        })
        .replace(/\//g, '\\/');

    return {
        method: route.method,
        regex: new RegExp(`^${regexStr}$`),
        paramNames,
        handler: route.handler,
    };
}

function matchesPathPattern(pattern: string | RegExp, path: string): boolean {
    if (typeof pattern === 'string') {
        return path.includes(pattern);
    }
    return pattern.test(path);
}

export class TestBuyOnDemandServer {
    private readonly _state = new ServerState();
    private readonly _routes: CompiledRoute[];
    private readonly _failures: FailureRule[] = [];
    private readonly _delays: DelayRule[] = [];

    constructor() {
        const allRoutes: RouteDefinition[] = [
            ...authRoutes,
            ...stationRoutes,
            ...menuItemRoutes,
            ...orderingRoutes,
            ...paymentRoutes,
            ...translationRoutes,
        ];
        this._routes = allRoutes.map(compileRoute);
    }

    // ── Fixture management ──────────────────────────────────────────

    /**
     * Register fixture data for a cafe (or '__default__' for fallback).
     */
    setFixture(cafeId: string, fixtureName: string, data: unknown): void {
        this._state.setFixture(cafeId, fixtureName, data);
    }

    /**
     * Mark the given cafe as shut down. The /config endpoint will return
     * properties.applicationShutOffConfig = { isShutOffEnabled: true,
     * instructionText: message }, which the real client interprets as a
     * normal-200 "we're closed" response (distinct from HTTP failures).
     *
     * Idempotent — repeated calls just overwrite the message.
     */
    markCafeShutdown(cafeId: string, message: string): void {
        const existing = this._state.getFixture<Record<string, unknown>>(cafeId, 'config');
        if (existing == null) {
            throw new Error(`Cannot mark ${cafeId} as shut down: no config fixture is loaded for this cafe.`);
        }
        const properties = { ...((existing.properties ?? {}) as Record<string, unknown>) };
        properties.applicationShutOffConfig = {
            isShutOffEnabled: true,
            instructionText: message,
        };
        this._state.setFixture(cafeId, 'config', { ...existing, properties });
    }

    /**
     * Clear the shutdown marker for a cafe. Restores normal config behavior.
     */
    clearCafeShutdown(cafeId: string): void {
        const existing = this._state.getFixture<Record<string, unknown>>(cafeId, 'config');
        if (existing == null) return;
        const properties = { ...((existing.properties ?? {}) as Record<string, unknown>) };
        delete properties.applicationShutOffConfig;
        this._state.setFixture(cafeId, 'config', { ...existing, properties });
    }

    /**
     * Returns the per-cafe expected entity counts based on what's loaded in
     * the fixture state. Lets tests assert exact counts after sync without
     * hardcoding numbers that change every time the fixture generator is
     * tuned.
     *
     * `stations` and `menuItems` reflect the fixture contents (what /concepts
     * and /kiosk-items would return for that cafe).
     */
    getFixtureSummary(): FixtureSummary {
        const perCafe = new Map<string, CafeFixtureSummary>();
        let totalStations = 0;
        let totalMenuItems = 0;
        let totalAppearances = 0;
        let totalWithTags = 0;
        let totalWithModifiers = 0;

        for (const cafeId of this._state.getCafeIdsWithFixtures()) {
            const stations = this._state.getFixture<Array<{
                menus: Array<{ categories: Array<{ items: string[] }> }>;
            }>>(cafeId, 'stations') ?? [];
            const items = this._state.getFixture<Array<{
                tagIds?: string[];
                _modifiers?: { modifiers?: unknown[] };
            }>>(cafeId, 'menu-items') ?? [];

            const appearances = stations.reduce((sum, station) => {
                return sum + station.menus.reduce((mSum, menu) => {
                    return mSum + menu.categories.reduce((cSum, cat) => cSum + cat.items.length, 0);
                }, 0);
            }, 0);
            const withTags = items.filter(i => i.tagIds != null && i.tagIds.length > 0).length;
            const withMods = items.filter(i => (i._modifiers?.modifiers?.length ?? 0) > 0).length;

            const summary: CafeFixtureSummary = {
                cafeId,
                stationCount: stations.length,
                menuItemCount: items.length,
                menuItemAppearanceCount: appearances,
                itemsWithTagsCount: withTags,
                itemsWithModifiersCount: withMods,
            };
            perCafe.set(cafeId, summary);
            totalStations += summary.stationCount;
            totalMenuItems += summary.menuItemCount;
            totalAppearances += summary.menuItemAppearanceCount;
            totalWithTags += summary.itemsWithTagsCount;
            totalWithModifiers += summary.itemsWithModifiersCount;
        }

        return {
            perCafe,
            totals: {
                cafes: perCafe.size,
                stations: totalStations,
                menuItems: totalMenuItems,
                menuItemAppearances: totalAppearances,
                itemsWithTags: totalWithTags,
                itemsWithModifiers: totalWithModifiers,
            },
        };
    }

    // ── Request handling ────────────────────────────────────────────

    /**
     * Handle a request from TestBuyOnDemandClient.
     * This is the core routing method — matches the path against registered
     * routes and dispatches to the appropriate handler.
     */
    async handleRequest(cafeId: string, method: string, path: string, options: { headers?: Record<string, string>; body?: string } = {}): Promise<TestResponse> {
        // Strip query string for route matching; handlers don't currently need
        // query params (the translation endpoint takes projectId/version that we
        // simply ignore for fixture lookup).
        const queryStart = path.indexOf('?');
        const matchPath = queryStart >= 0 ? path.slice(0, queryStart) : path;

        // Log the request
        let parsedBody: unknown;
        if (options.body) {
            try {
                parsedBody = JSON.parse(options.body);
            } catch {
                parsedBody = options.body;
            }
        }

        this._state.logRequest({
            timestamp: Date.now(),
            cafeId,
            method,
            path,
            body: parsedBody,
        });

        // Check failure injection
        const failureResponse = this._checkFailures(cafeId, method, matchPath);
        if (failureResponse) {
            return failureResponse;
        }

        // Check delay injection
        await this._applyDelay(cafeId, matchPath);

        // Auth validation — every endpoint except /login/anonymous requires
        // a Bearer token previously issued by /login/anonymous. Mirrors the
        // real BoD API so the test catches missing-Authorization-header bugs.
        const authResponse = this._validateAuth(method, matchPath, options.headers ?? {});
        if (authResponse) {
            return authResponse;
        }

        // Route matching
        const matched = this._matchRoute(method, matchPath);
        if (!matched) {
            return {
                status: 404,
                statusText: 'Not Found',
                body: { error: `No route matched: ${method} ${matchPath}` },
            };
        }

        const req: TestRequest = {
            method,
            path: matchPath,
            headers: options.headers ?? {},
            body: parsedBody,
            cafeId,
        };

        // Attach parsed route params to the request
        (req as any).params = matched.params;

        try {
            return await matched.handler(req, this._serverStateProxy());
        } catch (err) {
            return {
                status: 500,
                statusText: 'Internal Server Error',
                body: { error: String(err) },
            };
        }
    }

    private _matchRoute(method: string, path: string): MatchedRoute | null {
        for (const route of this._routes) {
            if (route.method !== method) continue;

            const match = route.regex.exec(path);
            if (!match) continue;

            const params: RouteParams = {};
            for (let i = 0; i < route.paramNames.length; i++) {
                params[route.paramNames[i]!] = match[i + 1]!;
            }

            return { handler: route.handler, params };
        }
        return null;
    }

    private _serverStateProxy(): ITestServerState {
        return {
            getFixture: <T>(cafeId: string, fixtureName: string) => this._state.getFixture<T>(cafeId, fixtureName),
            getOrderState: (orderId: string) => this._state.getOrderState(orderId),
            createOrder: (cafeId: string) => this._state.createOrder(cafeId),
            orders: this._state.orders,
            issuedTokens: this._state.issuedTokens,
            getTranslations: (namespace: string) => this._state.getTranslations(namespace),
        };
    }

    // ── Auth validation ─────────────────────────────────────────────
    //
    // Mirrors real BoD: every endpoint except /login/anonymous requires a
    // Bearer token previously issued by /login/anonymous. We validate here
    // (rather than per-handler) so any forgotten Authorization header in a
    // production code path surfaces as a 401 in tests.

    /** Paths that don't require auth (regex matched against request path). */
    private static readonly _PUBLIC_PATHS: RegExp[] = [
        /^\/login\/anonymous$/,
        // BoD translation endpoints are publicly readable on the real API.
        /^\/translation\//,
    ];

    private _validateAuth(method: string, path: string, headers: Record<string, string>): TestResponse | null {
        if (TestBuyOnDemandServer._PUBLIC_PATHS.some(rx => rx.test(path))) {
            return null;
        }

        // Headers are normalized by node-fetch to lowercase, but accept either.
        const authHeader = headers['authorization'] ?? headers['Authorization'];
        if (!authHeader) {
            return {
                status: 401,
                statusText: 'Unauthorized',
                body: { error: `Missing Authorization header on ${method} ${path}` },
            };
        }
        const match = /^Bearer\s+(.+)$/.exec(authHeader);
        if (!match) {
            return {
                status: 401,
                statusText: 'Unauthorized',
                body: { error: `Authorization header must be "Bearer <token>", got: ${authHeader}` },
            };
        }
        const token = match[1]!;
        if (!this._state.issuedTokens.has(token)) {
            return {
                status: 401,
                statusText: 'Unauthorized',
                body: { error: `Bearer token not recognized: ${token.slice(0, 20)}...` },
            };
        }
        return null;
    }

    // ── Failure injection ───────────────────────────────────────────

    injectFailure(rule: FailureRule): void {
        this._failures.push(rule);
    }

    injectDelay(rule: DelayRule): void {
        this._delays.push(rule);
    }

    /**
     * Inject a BoD-shape error response for one or more requests. Builds a
     * `{ statusCode, error, message: <code> }` JSON body with the right
     * content-type so the production `BuyOnDemandError` translation path
     * exercises end-to-end.
     */
    injectBoDError(opts: {
        /** Path matcher; can be a substring or a regex (regex strongly preferred). */
        pathPattern: string | RegExp;
        /** HTTP method to match (e.g. 'POST'). Defaults to any. */
        method?: string;
        /** BoD error code, e.g. 'CONCEPTS_NOT_AVAILABLE'. */
        code: string;
        /** HTTP status code BoD returns. Defaults to 400. */
        status?: number;
        /** Limit how many requests this matches. Defaults to unlimited. */
        count?: number;
        /** Limit to a single cafe. Defaults to any cafe. */
        cafeId?: string;
    }): void {
        const status = opts.status ?? 400;
        this._failures.push({
            pathPattern: opts.pathPattern,
            method:      opts.method,
            cafeId:      opts.cafeId,
            count:       opts.count,
            statusCode:  status,
            body: JSON.stringify({
                statusCode: status,
                error:      'Bad Request',
                message:    opts.code,
            }),
            headers: { 'content-type': 'application/json' },
        });
    }

    clearFailures(): void {
        this._failures.length = 0;
        this._delays.length = 0;
    }

    private _checkFailures(cafeId: string, method: string, path: string): TestResponse | null {
        for (let i = this._failures.length - 1; i >= 0; i--) {
            const rule = this._failures[i]!;

            if (rule.cafeId && rule.cafeId !== cafeId) continue;
            if (rule.method && rule.method !== method) continue;
            if (!matchesPathPattern(rule.pathPattern, path)) continue;

            // Matched — decrement count and remove if exhausted
            if (rule.count != null) {
                rule.count--;
                if (rule.count <= 0) {
                    this._failures.splice(i, 1);
                }
            }

            return {
                status: rule.statusCode,
                statusText: 'Injected Failure',
                rawBody: rule.body ?? '',
                headers: rule.headers,
            };
        }
        return null;
    }

    private async _applyDelay(cafeId: string, path: string): Promise<void> {
        for (let i = this._delays.length - 1; i >= 0; i--) {
            const rule = this._delays[i]!;

            if (rule.cafeId && rule.cafeId !== cafeId) continue;
            if (!matchesPathPattern(rule.pathPattern, path)) continue;

            if (rule.count != null) {
                rule.count--;
                if (rule.count <= 0) {
                    this._delays.splice(i, 1);
                }
            }

            await new Promise(resolve => setTimeout(resolve, rule.delayMs));
            return;
        }
    }

    // ── Introspection ───────────────────────────────────────────────

    getRequestLog(): RequestLogEntry[] {
        return [...this._state.requestLog];
    }

    clearRequestLog(): void {
        this._state.requestLog.length = 0;
    }

    getOrderState(orderId: string): OrderState | undefined {
        return this._state.getOrderState(orderId);
    }

    get state(): ServerState {
        return this._state;
    }

    // ── Translation registry mutators ──────────────────────────────
    //
    // Tests use these to override the i18n map served by GET /translation/...
    // Every mutator clears the active in-process translation cache so the
    // overrides take effect on the next request without any other plumbing.

    setTranslations(namespace: string, map: Record<string, string>): void {
        this._state.setTranslations(namespace, map);
        getServices().translations.clear();
    }

    setTranslation(code: string, message: string, namespace: string = 'core'): void {
        this._state.setTranslation(namespace, code, message);
        getServices().translations.clear();
    }

    getTranslations(namespace: string): Record<string, string> {
        return this._state.getTranslations(namespace);
    }

    resetTranslations(): void {
        this._state.resetTranslations();
        getServices().translations.clear();
    }

    /**
     * Reset all state: request log, orders, tokens, failures.
     * Does NOT clear fixtures — call resetAll() for that.
     */
    reset(): void {
        this._state.reset();
        this.clearFailures();
    }

    /**
     * Reset everything including fixtures.
     */
    resetAll(): void {
        this._state.resetAll();
        this.clearFailures();
    }
}
