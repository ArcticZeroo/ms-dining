import { TELEMETRY_CLIENT } from './app-insights.js';
import { getNamespaceLogger } from '../../util/log.js';

const logger = getNamespaceLogger('MetricAggregator');

interface Bucket {
    count: number;
    sum: number;
    sumOfSquares: number;
    min: number;
    max: number;
    properties?: Record<string, string>;
}

const makeKey = (name: string, properties?: Record<string, string>): string => {
    if (properties == null) {
        return name;
    }
    const keys = Object.keys(properties).sort();
    if (keys.length === 0) {
        return name;
    }
    return name + '|' + keys.map(k => `${k}=${properties[k]}`).join(',');
};

/**
 * Buffers metric samples in memory and periodically flushes them to App
 * Insights as pre-aggregated metrics. Pre-aggregation means one metric
 * payload per (name, properties, window) instead of one per sample, which
 * dramatically reduces ingestion volume and cost for high-frequency
 * measurements like per-query timings.
 *
 * App Insights supports pre-aggregation natively: `trackMetric` accepts
 * `count`, `min`, `max`, and `stdDev` alongside `value` (the sum), and
 * Kusto computes the same aggregates as if individual points had been sent.
 */
export class MetricAggregator {
    readonly #flushIntervalMs: number;
    readonly #buckets = new Map<string, Bucket>();
    #timer: NodeJS.Timeout | null = null;

    constructor(flushIntervalMs: number = 30_000) {
        this.#flushIntervalMs = flushIntervalMs;
    }

    start(): void {
        if (this.#timer != null) {
            return;
        }
        this.#timer = setInterval(() => this.flush(), this.#flushIntervalMs);
        // Don't keep the process alive just for telemetry flushing.
        this.#timer.unref();
    }

    stop(): void {
        if (this.#timer != null) {
            clearInterval(this.#timer);
            this.#timer = null;
        }
        this.flush();
    }

    record(name: string, value: number, properties?: Record<string, string>): void {
        if (!Number.isFinite(value)) {
            return;
        }

        const key = makeKey(name, properties);
        const existing = this.#buckets.get(key);
        if (existing == null) {
            this.#buckets.set(key, {
                count:        1,
                sum:          value,
                sumOfSquares: value * value,
                min:          value,
                max:          value,
                properties,
            });
            return;
        }

        existing.count++;
        existing.sum += value;
        existing.sumOfSquares += value * value;
        if (value < existing.min) {
            existing.min = value;
        }
        if (value > existing.max) {
            existing.max = value;
        }
    }

    flush(): void {
        if (this.#buckets.size === 0 || TELEMETRY_CLIENT == null) {
            this.#buckets.clear();
            return;
        }

        // Snapshot then clear so concurrent recorders don't lose data while
        // we send.
        const snapshot = Array.from(this.#buckets.entries());
        this.#buckets.clear();

        for (const [key, bucket] of snapshot) {
            const name = key.split('|', 1)[0]!;
            const mean = bucket.sum / bucket.count;
            const variance = Math.max(0, bucket.sumOfSquares / bucket.count - mean * mean);
            const stdDev = Math.sqrt(variance);

            try {
                TELEMETRY_CLIENT.trackMetric({
                    name,
                    value:      bucket.sum,
                    count:      bucket.count,
                    min:        bucket.min,
                    max:        bucket.max,
                    stdDev,
                    properties: bucket.properties,
                });
            } catch (err) {
                logger.error(`Failed to track metric ${name}:`, err);
            }
        }
    }
}
