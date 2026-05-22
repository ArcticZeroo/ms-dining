/**
 * Unit tests for LockedMap (the per-key serialization map used by daily-menu
 * caches and friends).
 *
 * Regression target: commit `4386d1f` — concurrent reads/writes on the same key
 * could double-populate the cached value when the update callback awaited.
 * The LockedMap guarantees per-key serialization while still allowing
 * different keys to run concurrently.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { LockedMap, LockedExpiringMap } from './map.js';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

test('concurrent update() calls for the same key serialize (no interleaving)', async () => {
    const map = new LockedMap<string, number>();
    let inFlight = 0;
    let maxInFlight = 0;
    const order: string[] = [];

    const makeCallback = (label: string) => async (value: number | undefined) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        order.push(`${label}-start`);
        // Yield to the event loop while holding the lock.
        await wait(25);
        order.push(`${label}-end`);
        inFlight--;
        return (value ?? 0) + 1;
    };

    await Promise.all([
        map.update('k', makeCallback('a')),
        map.update('k', makeCallback('b')),
        map.update('k', makeCallback('c')),
    ]);

    assert.equal(maxInFlight, 1, 'Only one callback should be running at a time for the same key');
    // Each callback must run start→end before the next starts.
    assert.deepEqual(order, [
        'a-start', 'a-end',
        'b-start', 'b-end',
        'c-start', 'c-end',
    ]);

    // Three increments → final value is 3.
    const final = await map.update('k', v => v);
    assert.equal(final, 3);
});

test('concurrent update() calls for different keys run concurrently', async () => {
    const map = new LockedMap<string, number>();
    let inFlight = 0;
    let maxInFlight = 0;

    const makeCallback = () => async (value: number | undefined) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await wait(30);
        inFlight--;
        return (value ?? 0) + 1;
    };

    await Promise.all([
        map.update('a', makeCallback()),
        map.update('b', makeCallback()),
        map.update('c', makeCallback()),
    ]);

    assert.equal(maxInFlight, 3, 'Three different keys should be able to run concurrently');
});

test('delete() clears the entry', async () => {
    const map = new LockedMap<string, string>();
    await map.update('k', () => 'value');
    assert.equal(await map.has('k'), true);
    assert.equal(map.size, 1);

    await map.delete('k');

    assert.equal(await map.has('k'), false);
    assert.equal(map.size, 0);

    // A subsequent update should start fresh (value === undefined in callback).
    let observedValue: string | undefined = 'NOT-CALLED' as string | undefined;
    await map.update('k', (v) => {
        observedValue = v;
        return 'fresh';
    });
    assert.equal(observedValue, undefined);
});

test('update() that throws does not poison the lock', async () => {
    const map = new LockedMap<string, number>();

    // First update succeeds, populates value.
    await map.update('k', () => 42);

    // Second update throws — must not leave the lock held.
    await assert.rejects(
        map.update('k', () => { throw new Error('boom'); }),
        /boom/,
    );

    // Third update must still be able to acquire the lock and observe the
    // pre-throw value (the failed callback's result was never persisted).
    let observedValue: number | undefined;
    const result = await map.update('k', (v) => {
        observedValue = v;
        return (v ?? 0) + 1;
    });
    assert.equal(observedValue, 42, 'The throw must not have mutated the cached value');
    assert.equal(result, 43);
});

test('delete() during contention waits for in-flight update to finish', async () => {
    const map = new LockedMap<string, string>();
    await map.update('k', () => 'initial');

    let updateFinished = false;
    const updatePromise = map.update('k', async (v) => {
        await wait(40);
        updateFinished = true;
        return v;
    });

    // Delete is dispatched while update is still in progress.
    const deletePromise = map.delete('k');

    await Promise.all([updatePromise, deletePromise]);

    assert.equal(updateFinished, true, 'In-flight update must complete before delete proceeds');
    assert.equal(await map.has('k'), false);
});

test('LockedExpiringMap: updateWithoutRefresh() keeps original expiration', async () => {
    const map = new LockedExpiringMap<string, number>(200);

    try {
        // Insert a value — it gets TTL = now + 200ms
        await map.update('k', () => 1);

        // Wait 100ms (half the TTL), then update without refreshing TTL
        await wait(100);
        await map.updateWithoutRefresh('k', (v) => (v ?? 0) + 1);

        // Value should be updated
        let observed: number | undefined;
        await map.peek('k', (v) => { observed = v; });
        assert.equal(observed, 2, 'Value should have been incremented');

        // Wait another 120ms — original TTL should have expired (200ms total)
        await wait(120);
        await map.peek('k', (v) => { observed = v; });
        assert.equal(observed, undefined, 'Entry should have expired based on original TTL');
    } finally {
        map.destroy();
    }
});

test('LockedExpiringMap: update() resets expiration', async () => {
    const map = new LockedExpiringMap<string, number>(200);

    try {
        await map.update('k', () => 1);

        // Wait 100ms, then update (default behavior resets TTL)
        await wait(100);
        await map.update('k', (v) => (v ?? 0) + 1);

        // Wait another 120ms — original TTL would have expired, but we reset it
        await wait(120);
        let observed: number | undefined;
        await map.peek('k', (v) => { observed = v; });
        assert.equal(observed, 2, 'Entry should still be alive because TTL was reset');

        // Wait for the reset TTL to expire
        await wait(100);
        await map.peek('k', (v) => { observed = v; });
        assert.equal(observed, undefined, 'Entry should have expired after reset TTL');
    } finally {
        map.destroy();
    }
});
