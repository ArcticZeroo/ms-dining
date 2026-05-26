import * as appInsights from 'applicationinsights';
import { WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../constants/env.js';
import { lazy } from '../util/lazy.js';
import { getNamespaceLogger } from '../util/log.js';

const logger = getNamespaceLogger('AppInsights');

const createTelemetryClient = (): appInsights.TelemetryClient | null => {
    const connectionString = process.env[WELL_KNOWN_ENVIRONMENT_VARIABLES.appInsightsConnectionString];

    if (!connectionString) {
        logger.info('Connection string not set, telemetry disabled');
        return null;
    }

    const client = new appInsights.TelemetryClient(connectionString);
    client.config.disableAppInsights = false;

    // Disable all auto-collection — we track requests manually via middleware
    client.config.noDiagnosticChannel = true;

    client.context.tags[client.context.keys.cloudRole] = 'ms-dining-prod';

    logger.info('Initialized');
    return client;
}

const TELEMETRY_CLIENT = lazy(createTelemetryClient);

export const getTelemetryClient = (): appInsights.TelemetryClient | null => TELEMETRY_CLIENT.value;

type FlushCallback = () => void | Promise<void>;
const preFlushCallbacks: FlushCallback[] = [];

/**
 * Register a callback to run before App Insights flushes. Used by the metric
 * aggregator to drain its in-memory buckets without creating an import cycle.
 */
export const registerPreFlush = (callback: FlushCallback): void => {
    preFlushCallbacks.push(callback);
};

export const flushTelemetry = async (): Promise<void> => {
    for (const callback of preFlushCallbacks) {
        try {
            await callback();
        } catch (err) {
            logger.error('Pre-flush callback failed:', err);
        }
    }

    const client = getTelemetryClient();
    if (client == null) {
        return;
    }

    try {
        await client.flush();
        logger.info('Flush complete');
    } catch (err) {
        logger.error('Flush failed:', err);
    }
};
