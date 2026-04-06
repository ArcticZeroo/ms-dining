import * as appInsights from 'applicationinsights';
import { DiagLogLevel, diag, DiagConsoleLogger } from '@opentelemetry/api';
import { WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../../constants/env.js';
import { getNamespaceLogger } from '../../util/log.js';

const logger = getNamespaceLogger('AppInsights');

// WARN level only — surfaces SDK export failures without noise
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

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

    logger.info(`Initialized (disableAppInsights=${client.config.disableAppInsights}, noDiagnosticChannel=${client.config.noDiagnosticChannel})`);
    return client;
}

export const TELEMETRY_CLIENT = createTelemetryClient();

export const flushTelemetry = async (): Promise<void> => {
    if (!TELEMETRY_CLIENT) {
        return;
    }

    try {
        await TELEMETRY_CLIENT.flush();
        logger.info('Flush complete');
    } catch (err) {
        logger.error('Flush failed:', err);
    }
};
