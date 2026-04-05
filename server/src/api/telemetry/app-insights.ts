import * as appInsights from 'applicationinsights';
import { hasEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../../constants/env.js';
import { logInfo } from '../../util/log.js';

const createTelemetryClient = (): appInsights.TelemetryClient | null => {
	const connectionString = process.env[WELL_KNOWN_ENVIRONMENT_VARIABLES.appInsightsConnectionString];

    if (!connectionString) {
        logInfo('App Insights connection string not set, telemetry disabled');
        return null;
    }

    const client = new appInsights.TelemetryClient(connectionString);
    client.config.disableAppInsights = false;

    // Disable all auto-collection — we track requests manually via middleware
    client.config.noDiagnosticChannel = true;

    client.context.tags[client.context.keys.cloudRole] = 'ms-dining-prod';

    logInfo('App Insights initialized');
    return client;
}

export const TELEMETRY_CLIENT = createTelemetryClient();
