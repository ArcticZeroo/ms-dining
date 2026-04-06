/**
 * Standalone App Insights diagnostic script.
 * Run: npx tsc && node dist/adhoc/test-appinsights.js
 *
 * Tests the full pipeline: SDK init → trackRequest → flush → verify export.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { DiagLogLevel, diag, DiagConsoleLogger } from '@opentelemetry/api';
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);

import * as appInsights from 'applicationinsights';
import { WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../constants/env.js';

const connectionString = process.env[WELL_KNOWN_ENVIRONMENT_VARIABLES.appInsightsConnectionString];
if (!connectionString) {
    console.error('APPLICATIONINSIGHTS_CONNECTION_STRING not set');
    process.exit(1);
}

console.log('Connection string found, creating client...');
const client = new appInsights.TelemetryClient(connectionString);
client.context.tags[client.context.keys.cloudRole] = 'ms-dining-test';

console.log('Sending test request telemetry...');
client.trackRequest({
    name: 'GET /test-diagnostic',
    url: 'http://localhost/test-diagnostic',
    duration: 42,
    resultCode: '200',
    success: true,
    properties: { source: 'diagnostic-script' },
});

console.log('Flushing...');
try {
    await client.flush();
    console.log('Flush complete. Check Kusto for cloud_RoleName == "ms-dining-test" in the next few minutes.');
} catch (err) {
    console.error('Flush failed:', err);
}

// Give the batch processor time to export
console.log('Waiting 10s for batch export...');
await new Promise(resolve => setTimeout(resolve, 10000));
console.log('Done. Check App Insights for the test entry.');
process.exit(0);
