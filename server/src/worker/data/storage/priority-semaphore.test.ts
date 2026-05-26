import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrioritySemaphore } from './priority-semaphore.js';

interface Deferred<T = void> {
    promise: Promise<T>;
    resolve: (value: T) => void;
}

function deferred<T = void>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(res => {
        resolve = res;
    });
    return { promise, resolve };
}

describe('PrioritySemaphore (lock mode, maxConcurrent=1)', () => {
    it('should run callback immediately when unlocked', async () => {
        const sem = new PrioritySemaphore(1);
        const result = await sem.acquire('background', async () => 42);
        assert.equal(result, 42);
    });

    it('should block a second caller until the first completes', async () => {
        const sem = new PrioritySemaphore(1);
        const gate = deferred();

        let secondStarted = false;
        const first = sem.acquire('background', () => gate.promise);
        const second = sem.acquire('background', async () => {
            secondStarted = true; 
        });

        await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(secondStarted, false, 'Second should not start while first holds lock');

        gate.resolve();
        await first;
        await second;
        assert.equal(secondStarted, true);
    });

    it('should release to highest priority waiter', async () => {
        const sem = new PrioritySemaphore(1);
        const gate = deferred();
        const order: string[] = [];

        const holder = sem.acquire('background', () => gate.promise);

        const bgDone = sem.acquire('background', async () => {
            order.push('background'); 
        });
        const normalDone = sem.acquire('normal', async () => {
            order.push('normal'); 
        });
        const criticalDone = sem.acquire('critical', async () => {
            order.push('critical'); 
        });

        gate.resolve();
        await Promise.all([holder, bgDone, normalDone, criticalDone]);

        assert.deepEqual(order, ['critical', 'normal', 'background']);
    });

    it('should handle multiple waiters at the same priority in FIFO order', async () => {
        const sem = new PrioritySemaphore(1);
        const gate = deferred();
        const order: number[] = [];

        const holder = sem.acquire('normal', () => gate.promise);

        const first = sem.acquire('normal', async () => {
            order.push(1);
        });
        const second = sem.acquire('normal', async () => {
            order.push(2);
        });
        const third = sem.acquire('normal', async () => {
            order.push(3);
        });

        gate.resolve();
        await Promise.all([holder, first, second, third]);

        assert.deepEqual(order, [1, 2, 3]);
    });

    it('should prioritize a later critical over earlier background waiters', async () => {
        const sem = new PrioritySemaphore(1);
        const gate = deferred();
        const order: string[] = [];

        const holder = sem.acquire('normal', () => gate.promise);

        const bgDone = sem.acquire('background', async () => {
            order.push('bg'); 
        });
        const critDone = sem.acquire('critical', async () => {
            order.push('crit'); 
        });

        gate.resolve();
        await Promise.all([holder, bgDone, critDone]);

        assert.deepEqual(order, ['crit', 'bg']);
    });

    it('should unlock after callback completes so next use is immediate', async () => {
        const sem = new PrioritySemaphore(1);
        await sem.acquire('normal', async () => {});

        let ran = false;
        await sem.acquire('background', async () => {
            ran = true; 
        });
        assert.equal(ran, true);
    });

    it('should release the lock even if the callback throws', async () => {
        const sem = new PrioritySemaphore(1);

        await assert.rejects(
            () => sem.acquire('normal', async () => {
                throw new Error('boom'); 
            }),
            { message: 'boom' }
        );

        let ran = false;
        await sem.acquire('background', async () => {
            ran = true; 
        });
        assert.equal(ran, true);
    });
});

describe('PrioritySemaphore (semaphore mode)', () => {
    it('should reject invalid maxConcurrent', () => {
        assert.throws(() => new PrioritySemaphore(0));
        assert.throws(() => new PrioritySemaphore(-1));
        assert.throws(() => new PrioritySemaphore(1.5));
    });

    it('should allow up to maxConcurrent callers to run simultaneously', async () => {
        const sem = new PrioritySemaphore(3);
        const gate = deferred();
        let started = 0;
        let maxObserved = 0;

        const tasks = Array.from({ length: 5 }, () => sem.acquire('normal', async () => {
            started++;
            maxObserved = Math.max(maxObserved, started);
            await gate.promise;
            started--;
        }));

        await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(maxObserved, 3, 'No more than 3 should be in flight at once');

        gate.resolve();
        await Promise.all(tasks);
    });

    it('should report inFlight and queueDepth accurately', async () => {
        const sem = new PrioritySemaphore(2);
        const gate = deferred();

        const task1 = sem.acquire('normal', () => gate.promise);
        const task2 = sem.acquire('normal', () => gate.promise);
        await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(sem.inFlight, 2);
        assert.equal(sem.queueDepth, 0);

        const task3 = sem.acquire('normal', async () => {});
        const task4 = sem.acquire('background', async () => {});
        await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(sem.inFlight, 2);
        assert.equal(sem.queueDepth, 2);

        gate.resolve();
        await Promise.all([task1, task2, task3, task4]);
        assert.equal(sem.inFlight, 0);
        assert.equal(sem.queueDepth, 0);
    });

    it('should serve queued waiters in priority order when permits free up', async () => {
        const sem = new PrioritySemaphore(2);
        const gate1 = deferred();
        const gate2 = deferred();
        const order: string[] = [];

        const holder1 = sem.acquire('normal', () => gate1.promise);
        const holder2 = sem.acquire('normal', () => gate2.promise);

        const bgTask = sem.acquire('background', async () => {
            order.push('bg');
        });
        const norm = sem.acquire('normal', async () => {
            order.push('norm');
        });
        const crit = sem.acquire('critical', async () => {
            order.push('crit');
        });

        await new Promise(resolve => setTimeout(resolve, 5));
        gate1.resolve();
        gate2.resolve();
        await Promise.all([holder1, holder2, bgTask, norm, crit]);

        assert.deepEqual(order, ['crit', 'norm', 'bg']);
    });
});
