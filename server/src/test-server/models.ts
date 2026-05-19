/**
 * Types used by the test server for request/response handling,
 * route matching, and failure injection.
 */

import { Response } from 'node-fetch';

export interface TestRequest {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
    cafeId: string;
}

export interface TestResponse {
    status: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: unknown;
    /** When set, body is treated as raw text instead of JSON. */
    rawBody?: string;
}

export type RouteHandler = (req: TestRequest, server: ITestServerState) => TestResponse | Promise<TestResponse>;

export interface RouteDefinition {
    method: string;
    /** Path pattern with :param placeholders, e.g. '/sites/:tenantId/:contextId/concepts/:displayProfileId' */
    pattern: string;
    handler: RouteHandler;
}

export interface FailureRule {
    /** Substring or regex to match against the request path */
    pathPattern: string | RegExp;
    /** If set, only match requests for this cafe */
    cafeId?: string;
    /** HTTP status code to return */
    statusCode: number;
    /** Response body */
    body?: string;
    /** Optional response headers (e.g. content-type for JSON error bodies). */
    headers?: Record<string, string>;
    /** Number of times to trigger (undefined = unlimited until cleared) */
    count?: number;
    /** Method to match (e.g. 'GET', 'POST'). If omitted, matches any method. */
    method?: string;
}

export interface DelayRule {
    /** Substring or regex to match against the request path */
    pathPattern: string | RegExp;
    /** If set, only match requests for this cafe */
    cafeId?: string;
    /** Delay in milliseconds */
    delayMs: number;
    /** Number of times to trigger (undefined = unlimited until cleared) */
    count?: number;
}

export interface RequestLogEntry {
    timestamp: number;
    cafeId: string;
    method: string;
    path: string;
    body?: unknown;
}

export interface CafeFixtureSummary {
    cafeId: string;
    /** Number of stations in the /concepts response for this cafe. */
    stationCount: number;
    /** Number of distinct items in the /kiosk-items response for this cafe. */
    menuItemCount: number;
    /**
     * Number of (item, category) pairings across all stations. Greater than
     * `menuItemCount` when items are deliberately listed in multiple
     * categories (intentional, mirrors real BoD behavior).
     */
    menuItemAppearanceCount: number;
    /** Number of items with a non-empty tagIds array. */
    itemsWithTagsCount: number;
    /** Number of items whose `_modifiers` field has at least one modifier. */
    itemsWithModifiersCount: number;
}

export interface FixtureSummary {
    perCafe: Map<string, CafeFixtureSummary>;
    totals: {
        cafes: number;
        stations: number;
        menuItems: number;
        menuItemAppearances: number;
        itemsWithTags: number;
        itemsWithModifiers: number;
    };
}

export interface OrderState {
    orderId: string;
    orderNumber: string;
    cafeId: string;
    lineItems: Array<{ lineItemId: string; [key: string]: unknown }>;
    taxExcludedTotal: number;
    taxTotal: number;
    totalDue: number;
    closed: boolean;
}

export interface ITestServerState {
    /** Per-cafe config fixtures */
    getFixture<T>(cafeId: string, fixtureName: string): T | undefined;
    /** Get or create order state */
    getOrderState(orderId: string): OrderState | undefined;
    /** Create a new order */
    createOrder(cafeId: string): OrderState;
    /** All orders */
    orders: Map<string, OrderState>;
    /** Issued auth tokens */
    issuedTokens: Set<string>;
    /** Return the translation map for a namespace (e.g. 'core', 'domain-<host>'). */
    getTranslations(namespace: string): Record<string, string>;
}

/** Parsed route params from pattern matching */
export type RouteParams = Record<string, string>;

export interface MatchedRoute {
    handler: RouteHandler;
    params: RouteParams;
}
