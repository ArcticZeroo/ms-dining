import { MetricAggregator } from '../telemetry/metric-aggregator.js';
import { registerPreFlush } from '../telemetry/app-insights.js';

/**
 * Singleton aggregator for DB-layer metrics. Started at module load time;
 * `unref()`ed timer doesn't keep the process alive. App Insights ingests
 * one pre-aggregated payload per metric per flush window (see
 * MetricAggregator), so this is cheap regardless of query volume.
 */
export const DB_METRICS = new MetricAggregator(30_000);
DB_METRICS.start();
registerPreFlush(() => DB_METRICS.flush());

export const DB_METRIC_NAMES = {
    waitMs:     'db.queue.wait_ms',
    durationMs: 'db.query.duration_ms',
    queueDepth: 'db.queue.depth',
    inFlight:   'db.in_flight',
} as const;
