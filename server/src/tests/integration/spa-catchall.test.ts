/**
 * Integration test for the SPA catch-all route.
 *
 * Verifies that requests to unknown paths (i.e. client-side routes) return
 * 200 with text/html so the SPA can handle its own routing.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';
import { fetchExpectStatus } from '../test-server/test-helpers.js';

let ctx: IntegrationTestContext;
let baseUrl: string;

before(async () => {
    ctx = await createIntegrationTestContext();
    baseUrl = await ctx.startWebserver();
}, { timeout: 60_000 });

after(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await ctx.cleanup();
});

test('GET to an unknown path returns 200 with HTML (SPA catch-all)', async () => {
    const res = await fetchExpectStatus(`${baseUrl}/some/unknown/client/route`, 200);

    const contentType = res.headers.get('content-type') ?? '';
    assert.ok(
        contentType.toLowerCase().includes('html'),
        `Content-Type should contain "html" (got: "${contentType}")`,
    );

    const body = await res.text();
    assert.ok(body.length > 0, 'body should not be empty');
    assert.ok(body.includes('<!'), 'body should look like an HTML document');
});

test('GET / returns 200 with HTML', async () => {
    const res = await fetchExpectStatus(`${baseUrl}/`, 200);

    const contentType = res.headers.get('content-type') ?? '';
    assert.ok(
        contentType.toLowerCase().includes('html'),
        `Content-Type should contain "html" (got: "${contentType}")`,
    );
});
