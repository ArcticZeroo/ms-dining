/**
 * Order-specific telemetry helpers.
 *
 * Adds an `order.` prefix to all event/metric names and a `source: order`
 * dimension so order telemetry is easy to filter in Kusto.
 */

import { getServices } from '../../../shared/services/registry.js';
import { getNamespaceLogger } from '../../../shared/util/log.js';
import { ServiceError } from '../../rpc/errors.js';

const orderLog = getNamespaceLogger('Order');
const ORDER_SOURCE = { source: 'order' } as const;

export const trackOrderEvent = (
    name: string,
    properties: Record<string, string>,
): void => {
    getServices().telemetry?.trackEvent({
        name:       `order.${name}`,
        properties: { ...ORDER_SOURCE, ...properties },
    });
};

export const trackOrderMetric = (
    name: string,
    value: number,
    properties?: Record<string, string>,
): void => {
    getServices().telemetry?.trackMetric({
        name:       `order.${name}`,
        value,
        properties: { ...ORDER_SOURCE, ...properties },
    });
};

// ── Route-level helper ─────────────────────────────────────────────

const errorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

const errorCode = (err: unknown): string =>
    err instanceof ServiceError ? err.code : 'UNKNOWN';

interface ITrackedOrderStepOptions<T> {
    /** Name prefix for events: emits {name}.started, {name}.completed, {name}.failed */
    name: string;
    /** Dimensions attached to all events (Started, Completed, Failed) */
    properties: Record<string, string>;
    /** The async operation to execute and time */
    execute: () => Promise<T>;
    /** Extra dimensions for the Completed event (receives the result) */
    completedProperties?: (result: T) => Record<string, string>;
    /** Metric name for duration tracking (omit to skip metric) */
    durationMetric?: string;
    /** Extra dimensions for the duration metric */
    durationMetricProperties?: Record<string, string>;
}

/**
 * Executes an order step with standardized telemetry:
 * - Emits `{name}Started` before the operation
 * - Times the operation
 * - On success: emits `{name}Completed` with durationMs + custom properties
 * - On failure: emits `{name}Failed` with durationMs + errorCode + errorMessage, then re-throws
 */
export const executeTrackedOrderStep = async <T>(options: ITrackedOrderStepOptions<T>): Promise<T> => {
    const { name, properties, execute, completedProperties, durationMetric, durationMetricProperties } = options;

    trackOrderEvent(`${name}.started`, properties);

    const startMs = Date.now();
    try {
        const result = await execute();
        const durationMs = Date.now() - startMs;

        trackOrderEvent(`${name}.completed`, {
            ...properties,
            durationMs: String(durationMs),
            ...completedProperties?.(result),
        });

        if (durationMetric) {
            trackOrderMetric(durationMetric, durationMs, durationMetricProperties);
        }

        return result;
    } catch (err) {
        const durationMs = Date.now() - startMs;
        trackOrderEvent(`${name}.failed`, {
            ...properties,
            durationMs:   String(durationMs),
            errorCode:    errorCode(err),
            errorMessage: errorMessage(err),
        });
        throw err;
    }
};

// ── Orchestrator-level helpers (log + track in one call) ────────────

/**
 * Tracks a pre-kitchen failure: the order failed before it was sent
 * to the kitchen (before closeOrder stage). Logs + emits telemetry.
 * The error is still re-thrown by the caller — this just records it.
 */
export const trackPreKitchenFailure = (
    pendingOrderId: string,
    stage: string,
    err: unknown,
): void => {
    trackOrderEvent('preKitchen.failure', {
        pendingOrderId,
        stage,
        errorMessage: errorMessage(err),
    });
    orderLog.error(`Order failed before reaching kitchen (stage: ${stage}):`, err);
};

/**
 * Tracks a post-close recovery: the order was already placed upstream
 * but the completion flow errored. Logs + emits telemetry.
 */
export const trackPostCloseRecovery = (
    pendingOrderId: string,
    stage: string,
    err: unknown,
): void => {
    trackOrderEvent('postClose.recovery', {
        pendingOrderId,
        stage,
        originalError: errorMessage(err),
    });
    orderLog.error('Post-close failure (order already placed):', err);
};

/**
 * Tracks a DB persist failure: the order was placed upstream but the
 * completed-order DB write failed. Logs + emits telemetry.
 */
export const trackDbPersistFailed = (
    pendingOrderId: string,
    orderNumber: string | number,
    err: unknown,
): void => {
    trackOrderEvent('dbPersist.failed', {
        pendingOrderId,
        orderNumber:  String(orderNumber),
        errorMessage: errorMessage(err),
    });
    orderLog.error(`Failed to create completed order for pending order ${pendingOrderId}:`, err);
};
