/**
 * In-memory state management for the test server.
 * Tracks auth tokens, orders, and request logs.
 */

import { OrderState, RequestLogEntry } from './models.js';

let orderCounter = 0;

export class ServerState {
    readonly issuedTokens = new Set<string>();
    readonly issuedCsrfTokens = new Set<string>();
    readonly orders = new Map<string, OrderState>();
    readonly requestLog: RequestLogEntry[] = [];

    private _fixtureData = new Map<string, Map<string, unknown>>();

    // Translations: namespace -> code -> message. Stored separately from the
    // per-cafe fixture map because translations are global, not per-cafe.
    private _translations = new Map<string /*namespace*/, Map<string /*code*/, string>>();
    // Snapshot of the initial fixture-loaded translations, for resetTranslations().
    private _initialTranslations = new Map<string, Map<string, string>>();

    generateToken(): string {
        const token = `test-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.issuedTokens.add(token);
        return token;
    }

    generateCsrfToken(): string {
        const token = `test-csrf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.issuedCsrfTokens.add(token);
        return token;
    }

    createOrder(cafeId: string): OrderState {
        const orderId = `test-order-${++orderCounter}`;
        const orderNumber = String(1000 + orderCounter);
        const order: OrderState = {
            orderId,
            orderNumber,
            cafeId,
            lineItems: [],
            taxExcludedTotal: 0,
            taxTotal: 0,
            totalDue: 0,
            closed: false,
        };
        this.orders.set(orderId, order);
        return order;
    }

    getOrderState(orderId: string): OrderState | undefined {
        return this.orders.get(orderId);
    }

    logRequest(entry: RequestLogEntry): void {
        this.requestLog.push(entry);
    }

    /**
     * Register fixture data for a cafe.
     * @param cafeId The cafe ID, or '__default__' for fallback fixtures
     * @param fixtureName The fixture name (e.g. 'config', 'stations', 'menu-items')
     * @param data The fixture data
     */
    setFixture(cafeId: string, fixtureName: string, data: unknown): void {
        let cafeFixtures = this._fixtureData.get(cafeId);
        if (!cafeFixtures) {
            cafeFixtures = new Map();
            this._fixtureData.set(cafeId, cafeFixtures);
        }
        cafeFixtures.set(fixtureName, data);
    }

    /**
     * Get fixture data for a cafe, falling back to defaults.
     */
    getFixture<T>(cafeId: string, fixtureName: string): T | undefined {
        const cafeFixtures = this._fixtureData.get(cafeId);
        if (cafeFixtures?.has(fixtureName)) {
            return cafeFixtures.get(fixtureName) as T;
        }
        const defaults = this._fixtureData.get('__default__');
        return defaults?.get(fixtureName) as T | undefined;
    }

    /** Returns the IDs of all cafes with at least one registered fixture. */
    getCafeIdsWithFixtures(): string[] {
        return [...this._fixtureData.keys()].filter(id => id !== '__default__');
    }

    // ── Translation registry (BoD /translation/... endpoint) ──────────────

    /**
     * Load the initial translation set (called once during fixture loading).
     * Snapshots the data so resetTranslations() can restore it.
     */
    loadInitialTranslations(namespace: string, map: Record<string, string>): void {
        const live = new Map(Object.entries(map));
        this._translations.set(namespace, live);
        this._initialTranslations.set(namespace, new Map(live));
    }

    setTranslations(namespace: string, map: Record<string, string>): void {
        this._translations.set(namespace, new Map(Object.entries(map)));
    }

    setTranslation(namespace: string, code: string, message: string): void {
        let ns = this._translations.get(namespace);
        if (!ns) {
            ns = new Map();
            this._translations.set(namespace, ns);
        }
        ns.set(code, message);
    }

    getTranslations(namespace: string): Record<string, string> {
        const ns = this._translations.get(namespace);
        if (!ns) return {};
        return Object.fromEntries(ns);
    }

    resetTranslations(): void {
        this._translations.clear();
        for (const [namespace, map] of this._initialTranslations) {
            this._translations.set(namespace, new Map(map));
        }
    }

    /**
     * Reset all state (for between-test cleanup).
     */
    reset(): void {
        this.issuedTokens.clear();
        this.issuedCsrfTokens.clear();
        this.orders.clear();
        this.requestLog.length = 0;
        orderCounter = 0;
    }

    /**
     * Reset state and fixtures.
     */
    resetAll(): void {
        this.reset();
        this._fixtureData.clear();
        this._translations.clear();
        this._initialTranslations.clear();
    }
}
