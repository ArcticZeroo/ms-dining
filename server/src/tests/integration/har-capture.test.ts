/**
 * Integration test for HAR capture in BuyOnDemandClient.
 *
 * Regression target `35b84c6` ("fix: prevent HAR capture from deadlocking
 * response stream"). Pre-fix, requestAsync called `response.clone()` and
 * then `cloned.text()` for HAR capture but returned the *original*
 * response. node-fetch's clone() tees the underlying ReadableStream, so
 * both branches must drain for data to flow. When the caller eventually
 * tried to read the original (e.g. await response.json() in
 * #performLoginAsync), the read deadlocked because the cloned branch
 * had already buffered everything.
 *
 * The fix: read the body text exactly once inside requestAsync, hand it
 * to buildHarEntry, and return a *new* Response constructed from the
 * captured text so the caller can still call .json() / .text().
 *
 * This test asserts the contract end-to-end against the real production
 * BuyOnDemandClient.requestAsync path:
 *   - HAR capture is enabled before the request
 *   - The request goes through fetch() against a real local HTTP server
 *     (so node-fetch's streaming/teeing behavior is in play, unlike the
 *     in-memory TestBuyOnDemandClient which constructs Response from a
 *     string and has no streams to deadlock)
 *   - The caller can still .json() the response after HAR capture ran
 *   - The HAR capture got an entry containing the response body text
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { BuyOnDemandClient } from '../../worker/data/cafe/buy-ondemand/buy-ondemand-client.js';
import { HarCapture } from '../../shared/util/har.js';
import { ICafe } from '../../shared/models/cafe.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';

/**
 * Subclass that overrides _getUrl to point at our local HTTP server.
 * Everything else — fetch(), HAR capture, the body-read-once-and-rebuild
 * pattern — runs on the production code path.
 *
 * (The integration test context's TestBuyOnDemandClient overrides
 * requestAsync entirely and routes to an in-memory server with
 * non-streaming Response, so it cannot reproduce the original
 * deadlock. We need a real fetch + real HTTP server here.)
 */
class LocalHttpBuyOnDemandClient extends BuyOnDemandClient {
    readonly #baseUrl: string;

    constructor(cafe: ICafe, baseUrl: string) {
        super(cafe);
        this.#baseUrl = baseUrl;
    }

    protected override _getUrl(path: string): string {
        return `${this.#baseUrl}${path}`;
    }
}

interface ServerHandle {
    baseUrl: string;
    close: () => Promise<void>;
}

const startLocalHttpServer = async (
    responses: Map<string, { status: number; body: string; contentType?: string }>,
): Promise<ServerHandle> => {
    const server = http.createServer((req, res) => {
        const url = req.url ?? '/';
        const fixture = responses.get(url);
        if (!fixture) {
            res.statusCode = 404;
            res.end('not found');
            return;
        }
        // Drain request body before responding so node-fetch's request stream
        // is fully consumed (mirrors a real HTTP server).
        req.on('data', () => { /* discard */ });
        req.on('end', () => {
            res.statusCode = fixture.status;
            res.setHeader('Content-Type', fixture.contentType ?? 'application/json');
            res.end(fixture.body);
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });

    const addr = server.address() as AddressInfo;
    return {
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close:   () => new Promise<void>((resolve, reject) =>
            server.close(err => err ? reject(err) : resolve())),
    };
};

const FAKE_CAFE: ICafe = {
    id:   'har-test-cafe',
    name: 'HAR Test Cafe',
};

let handle: ServerHandle;
let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();

    handle = await startLocalHttpServer(new Map([
        ['/login/anonymous', {
            status: 200,
            body:   JSON.stringify({ csrfToken: 'test-csrf-from-local-server' }),
        }],
        ['/menu/items', {
            status: 200,
            body:   JSON.stringify({
                items: [
                    { id: 'item-1', name: 'Cheeseburger' },
                    { id: 'item-2', name: 'Veggie Wrap' },
                ],
            }),
        }],
    ]));
});

after(async () => {
    await handle.close();
    await ctx.cleanup();
});

test('BuyOnDemandClient with HAR capture lets the caller read the response body', async () => {
    const client = new LocalHttpBuyOnDemandClient(FAKE_CAFE, handle.baseUrl);
    const capture: HarCapture = client.enableHarCapture();

    // Make a request through the production requestAsync path. Pre-fix, the
    // .json() below would hang forever because response.clone() + reading
    // the cloned body deadlocked the original stream.
    const response = await client.requestAsync('/login/anonymous', { method: 'GET' });
    const body = await response.json() as { csrfToken: string };

    assert.equal(body.csrfToken, 'test-csrf-from-local-server',
        'caller must be able to .json() the response after HAR capture ran');

    // HAR capture got an entry for the request.
    assert.equal(capture.size, 1);
    const entry = capture.toJSON().log.entries[0]!;
    assert.equal(entry.request.url, `${handle.baseUrl}/login/anonymous`);
    assert.equal(entry.request.method, 'GET');
    assert.equal(entry.response.status, 200);
    assert.equal(
        entry.response.content.text,
        JSON.stringify({ csrfToken: 'test-csrf-from-local-server' }),
        'HAR entry must contain the exact response body text',
    );
});

test('HAR capture stays intact across multiple sequential requests', async () => {
    const client = new LocalHttpBuyOnDemandClient(FAKE_CAFE, handle.baseUrl);
    const capture = client.enableHarCapture();

    const loginRes = await client.requestAsync('/login/anonymous', { method: 'GET' });
    const loginBody = await loginRes.json() as { csrfToken: string };
    assert.equal(loginBody.csrfToken, 'test-csrf-from-local-server');

    const menuRes = await client.requestAsync('/menu/items', { method: 'GET' });
    const menuBody = await menuRes.json() as { items: Array<{ id: string }> };
    assert.equal(menuBody.items.length, 2);
    assert.equal(menuBody.items[0]!.id, 'item-1');

    assert.equal(capture.size, 2, 'each request must produce exactly one HAR entry');
    const urls = capture.toJSON().log.entries.map(entry => entry.request.url);
    assert.deepEqual(urls, [
        `${handle.baseUrl}/login/anonymous`,
        `${handle.baseUrl}/menu/items`,
    ]);
});

test('without HAR capture enabled, the caller still gets a readable response', async () => {
    const client = new LocalHttpBuyOnDemandClient(FAKE_CAFE, handle.baseUrl);
    // No enableHarCapture() — exercises the non-HAR branch of requestAsync.

    const response = await client.requestAsync('/login/anonymous', { method: 'GET' });
    const body = await response.json() as { csrfToken: string };
    assert.equal(body.csrfToken, 'test-csrf-from-local-server');
    assert.equal(client.harCapture, null);
});
