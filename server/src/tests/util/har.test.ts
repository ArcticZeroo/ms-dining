import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHarEntry, HarCapture } from '../../shared/util/har.js';

// 35b84c6: response.clone() tees the underlying ReadableStream and requires
// BOTH branches to be consumed before data flows. When HAR capture cloned
// the response and the original body wasn't read until later, the stream
// deadlocked. The fix: read the body once, hand the text to buildHarEntry,
// and rebuild a fresh Response so the caller can still call .json()/.text().
//
// End-to-end coverage for the deadlock fix lives in
// server/src/tests/integration/har-capture.test.ts — those tests exercise
// the production BuyOnDemandClient.requestAsync path against a real local
// HTTP server (so node-fetch's streaming/teeing behavior is actually in
// play). This file only covers the pure helpers.

describe('buildHarEntry', () => {
    it('serializes request + response data into the documented HAR shape', () => {
        const bodyText = JSON.stringify({ ok: true });
        const entry = buildHarEntry(
            'https://example.test/api/menu',
            { method: 'POST', headers: { authorization: 'Bearer xyz' }, body: '{"q":1}' },
            {
                status:      201,
                statusText:  'Created',
                headers:     [['x-trace-id', 'abc123'], ['content-type', 'application/json']],
                contentType: 'application/json',
            },
            bodyText,
        );

        // Snapshot-style assertion of the whole shape — every field we care
        // about in one place, instead of a swarm of per-field equals that
        // mostly re-state the call's literals. `time` is pinned to 0 (the
        // current implementation hardcodes it); if that ever becomes a
        // computed elapsed value, this assertion should be tightened.
        assert.deepEqual(
            { ...entry, startedDateTime: '<iso>' },
            {
                startedDateTime: '<iso>',
                time:            0,
                request:         {
                    method:   'POST',
                    url:      'https://example.test/api/menu',
                    headers:  [{ name: 'authorization', value: 'Bearer xyz' }],
                    postData: { mimeType: 'application/json', text: '{"q":1}' },
                },
                response:        {
                    status:     201,
                    statusText: 'Created',
                    headers:    [
                        { name: 'x-trace-id', value: 'abc123' },
                        { name: 'content-type', value: 'application/json' },
                    ],
                    content:    {
                        size:     bodyText.length,
                        mimeType: 'application/json',
                        text:     bodyText,
                    },
                },
            },
        );
        // Sanity check that startedDateTime is an ISO timestamp (the snapshot
        // above replaces it so the test isn't flaky).
        assert.match(entry.startedDateTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('omits postData when no request body is supplied and defaults method to GET', () => {
        // Behavior worth pinning explicitly: a missing body must NOT be
        // serialized as `postData: { text: '' }` (some HAR consumers treat
        // any postData as evidence of a request body).
        const entry = buildHarEntry(
            'https://example.test/api/items',
            {},
            { status: 200, statusText: 'OK', headers: [] },
            '[]',
        );
        assert.equal(entry.request.method, 'GET');
        assert.equal(entry.request.postData, undefined);
    });

    it('falls back to application/json mimeType when no contentType is supplied', () => {
        const entry = buildHarEntry(
            'https://example.test/api/x',
            {},
            { status: 200, statusText: 'OK', headers: [] },
            '{}',
        );
        assert.equal(entry.response.content.mimeType, 'application/json');
    });
});

describe('HarCapture', () => {
    it('starts empty and grows with addEntry', () => {
        const capture = new HarCapture();
        assert.equal(capture.size, 0);

        capture.addEntry(buildHarEntry(
            'https://example.test/a',
            {},
            { status: 200, statusText: 'OK', headers: [] },
            'x',
        ));
        capture.addEntry(buildHarEntry(
            'https://example.test/b',
            {},
            { status: 200, statusText: 'OK', headers: [] },
            'y',
        ));

        assert.equal(capture.size, 2);
    });

    it('serializes to HAR 1.2 envelope with all entries', () => {
        const capture = new HarCapture();
        capture.addEntry(buildHarEntry(
            'https://example.test/a',
            {},
            { status: 200, statusText: 'OK', headers: [] },
            'x',
        ));

        const json = capture.toJSON();
        assert.equal(json.log.version, '1.2');
        assert.equal(json.log.creator.name, 'ms-dining');
        assert.equal(json.log.entries.length, 1);
        assert.equal(json.log.entries[0]!.request.url, 'https://example.test/a');
    });
});
