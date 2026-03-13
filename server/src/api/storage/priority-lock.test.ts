import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PriorityLock } from './priority-lock.js';

interface Deferred<T = void> {
    promise: Promise<T>;
    resolve: (value: T) => void;
}

function deferred<T = void>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}

describe('PriorityLock', () => {
    it('should run callback immediately when unlocked', async () => {
        const lock = new PriorityLock();
        const result = await lock.acquire('background', async () => 42);
        assert.equal(result, 42);
    });

    it('should block a second caller until the first completes', async () => {
        const lock = new PriorityLock();
        const gate = deferred();

        let secondStarted = false;
        const first = lock.acquire('background', () => gate.promise);
        const second = lock.acquire('background', async () => { secondStarted = true; });

        await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(secondStarted, false, 'Second should not start while first holds lock');

        gate.resolve();
        await first;
        await second;
        assert.equal(secondStarted, true);
    });

    it('should release to highest priority waiter', async () => {
        const lock = new PriorityLock();
        const gate = deferred();
        const order: string[] = [];

        // Hold the lock
        const holder = lock.acquire('background', () => gate.promise);

        // Queue three waiters at different priorities
        const bgDone = lock.acquire('background', async () => { order.push('background'); });
        const normalDone = lock.acquire('normal', async () => { order.push('normal'); });
        const criticalDone = lock.acquire('critical', async () => { order.push('critical'); });

        // Release the holder — waiters should run in priority order
        gate.resolve();
        await Promise.all([holder, bgDone, normalDone, criticalDone]);

        assert.deepEqual(order, ['critical', 'normal', 'background']);
    });

    it('should handle multiple waiters at the same priority in FIFO order', async () => {
        const lock = new PriorityLock();
        const gate = deferred();
        const order: number[] = [];

        const holder = lock.acquire('normal', () => gate.promise);

        const p1 = lock.acquire('normal', async () => { order.push(1); });
        const p2 = lock.acquire('normal', async () => { order.push(2); });
        const p3 = lock.acquire('normal', async () => { order.push(3); });

        gate.resolve();
        await Promise.all([holder, p1, p2, p3]);

        assert.deepEqual(order, [1, 2, 3]);
    });

    it('should prioritize a later critical over earlier background waiters', async () => {
        const lock = new PriorityLock();
        const gate = deferred();
        const order: string[] = [];

        const holder = lock.acquire('normal', () => gate.promise);

        // Queue background first, then critical
        const bgDone = lock.acquire('background', async () => { order.push('bg'); });
        const critDone = lock.acquire('critical', async () => { order.push('crit'); });

        gate.resolve();
        await Promise.all([holder, bgDone, critDone]);

        assert.deepEqual(order, ['crit', 'bg']);
    });

    it('should unlock after callback completes so next use is immediate', async () => {
        const lock = new PriorityLock();
        await lock.acquire('normal', async () => {});

        let ran = false;
        await lock.acquire('background', async () => { ran = true; });
        assert.equal(ran, true);
    });

    it('should release the lock even if the callback throws', async () => {
        const lock = new PriorityLock();

        await assert.rejects(
            () => lock.acquire('normal', async () => { throw new Error('boom'); }),
            { message: 'boom' }
        );

        // Lock should be free now
        let ran = false;
        await lock.acquire('background', async () => { ran = true; });
        assert.equal(ran, true);
    });
});
