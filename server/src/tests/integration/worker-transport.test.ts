/**
 * Integration tests for the cross-thread worker transport.
 *
 * These tests spawn a real WorkerThreadHandler → worker/data/entry.ts,
 * send requests through the postMessage boundary, and validate:
 *   1. Read-only queries return correct data through structuredClone
 *   2. Writes persist and are visible through subsequent reads
 *   3. ServiceErrors propagate with the correct code and message
 *   4. Large nested results survive structuredClone round-tripping
 *   5. Concurrent requests resolve independently
 */

import { after, before, describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkerThreadHandler } from '../../worker/rpc/handler.js';
import type { DataServiceMap } from '../../shared/services/data-service-contract.generated.js';
import { createDataServices } from '../../shared/services/create-data-services.js';
import type { DataServices } from '../../shared/services/create-data-services.js';
import { createTestDatabase, type TestDatabase } from '../test-server/test-database.js';

let db: TestDatabase;
let handler: WorkerThreadHandler<DataServiceMap>;
let data: DataServices;

before(async () => {
    db = await createTestDatabase();

    handler = new WorkerThreadHandler<DataServiceMap>(
        new URL('../../worker/data/entry.js', import.meta.url),
    );

    data = createDataServices(handler);

    // Wait for worker to initialize (migrations, etc.) by probing
    // until the parentPort listener is registered and responsive.
    const maxWait = 60_000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        try {
            await data.cafe.retrieveCafes({});
            break;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
});

after(async () => {
    await handler.terminate();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await db.cleanup();
});

describe('cross-thread worker transport', () => {
    test('read-only: retrieveCafes returns seeded cafes', async () => {
        const cafes = await data.cafe.retrieveCafes({});
        assert.ok(cafes, 'should return a record');
        const ids = Object.keys(cafes);
        assert.ok(ids.length > 0, 'should have seeded cafes');

        const cafe25 = cafes['cafe25'];
        assert.ok(cafe25, 'cafe25 should exist in seeded data');
        assert.equal(cafe25.name, 'Café 25');
    });

    test('read-only: single cafe lookup', async () => {
        const cafe = await data.cafe.retrieveCafe({ id: 'cafe25' });
        assert.ok(cafe, 'should find cafe25');
        assert.equal(cafe.id, 'cafe25');
    });

    test('read-only: missing cafe returns null', async () => {
        const cafe = await data.cafe.retrieveCafe({ id: 'nonexistent-cafe' });
        assert.equal(cafe, null);
    });

    test('write + read: create user and read back', async () => {
        const externalId = `test-worker-${Date.now()}`;
        const result = await data.user.createUser({
            user: { displayName: 'Worker Test User', externalId, provider: 'test' },
        });

        const user = await data.user.getUser({ id: result.id });
        assert.ok(user, 'user should exist after create');
        assert.equal(user.displayName, 'Worker Test User');
    });

    test('missing session returns null/undefined (not an error)', async () => {
        const session = await data.session.get({ sessionId: 'nonexistent-session-id' });
        assert.ok(session == null, 'missing session should be null or undefined');
    });

    test('concurrent requests resolve independently', async () => {
        const [cafes, cafe25, exists] = await Promise.all([
            data.cafe.retrieveCafes({}),
            data.cafe.retrieveCafe({ id: 'cafe25' }),
            data.cafe.doesCafeExist({ id: 'cafe25' }),
        ]);

        assert.ok(cafes);
        assert.ok(cafe25);
        assert.equal(cafe25.id, 'cafe25');
        assert.equal(exists, true);
    });

    test('large nested result survives structuredClone', async () => {
        const cafes = await data.cafe.retrieveCafes({});
        const ids = Object.keys(cafes);
        assert.ok(ids.length >= 20, `expected 20+ cafes, got ${ids.length}`);

        for (const id of ids) {
            const cafe = cafes[id]!;
            assert.equal(typeof cafe.id, 'string', 'cafe.id should be a string');
            assert.equal(typeof cafe.name, 'string', 'cafe.name should be a string');
        }
    });

    test('doesCafeExist returns false for missing cafe', async () => {
        const exists = await data.cafe.doesCafeExist({ id: 'no-such-cafe' });
        assert.equal(exists, false);
    });

    test('write + read: update user display name', async () => {
        const externalId = `test-update-${Date.now()}`;
        const created = await data.user.createUser({
            user: { displayName: 'Original Name', externalId, provider: 'test' },
        });

        await data.user.updateUserDisplayName({
            id:          created.id,
            displayName: 'Updated Name',
        });

        const user = await data.user.getUser({ id: created.id });
        assert.ok(user);
        assert.equal(user.displayName, 'Updated Name');
    });

    test('ServiceError propagates across the boundary', async () => {
        // Calling sendRequest with an unknown service name triggers
        // a BAD_REQUEST ServiceError in the worker's dispatch function.
        await assert.rejects(
            () => handler.sendRequest('nonexistent' as any, 'method' as any, undefined as never),
            (err: any) => {
                assert.equal(err.code, 'BAD_REQUEST');
                assert.match(err.message, /Unknown service/);
                return true;
            },
        );
    });
});
