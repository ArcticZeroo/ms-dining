import { isMainThread } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

// performance.now() is monotonic per-thread and unaffected by Date.now() mocks
// (integration tests mock Date.now to pin "today"), so use it for relative
// boot timing rather than Date.now().
const BOOT_START_PERF = performance.now();
const THREAD_LABEL = isMainThread ? 'main' : 'worker';

const msSinceBoot = (): number => Math.round(performance.now() - BOOT_START_PERF);

export const logBoot = (...args: unknown[]): void => {
    console.log(`[BootTrace +${msSinceBoot()}ms ${THREAD_LABEL}]`, ...args);
};

/**
 * Wrap a function so the first invocation logs entry + exit timing with the
 * given name. Subsequent invocations are passed through unchanged with zero
 * overhead beyond a boolean check.
 */
export const oneShot = <TArgs extends unknown[], TResult>(
    name: string,
    func: (...args: TArgs) => TResult
): ((...args: TArgs) => TResult) => {
    let fired = false;
    return (...args: TArgs): TResult => {
        if (fired) {
            return func(...args);
        }
        fired = true;

        const startMs = performance.now();
        logBoot(`${name} entered`);

        const logExit = () => {
            logBoot(`${name} exited (${Math.round(performance.now() - startMs)}ms)`);
        };

        let result: TResult;
        try {
            result = func(...args);
        } catch (err) {
            logBoot(`${name} threw (${Math.round(performance.now() - startMs)}ms):`, err);
            throw err;
        }

        if (result != null && typeof (result as { then?: unknown }).then === 'function') {
            (result as unknown as Promise<unknown>).then(logExit, () => logBoot(`${name} rejected (${Math.round(performance.now() - startMs)}ms)`));
        } else {
            logExit();
        }

        return result;
    };
};

/**
 * Schedules a setTimeout(checkIntervalMs) repeatedly and logs whenever the
 * observed delay exceeds expected + thresholdMs. Indicates main-thread
 * event-loop blocking. Auto-stops after `durationMs` so it doesn't run
 * forever in production.
 */
export const startEventLoopLagMonitor = ({
    checkIntervalMs = 200,
    thresholdMs = 250,
    durationMs = 10 * 60 * 1000,
}: {
    checkIntervalMs?: number;
    thresholdMs?: number;
    durationMs?: number;
} = {}): void => {
    let last = performance.now();
    const startedAt = last;

    const handle: NodeJS.Timeout = setInterval(() => {
        const now = performance.now();
        const drift = now - last - checkIntervalMs;
        last = now;

        if (drift >= thresholdMs) {
            console.log(`[EventLoopLag +${msSinceBoot()}ms ${THREAD_LABEL}] blocked for ${Math.round(drift)}ms`);
        }

        if (now - startedAt >= durationMs) {
            clearInterval(handle);
            console.log(`[EventLoopLag +${msSinceBoot()}ms ${THREAD_LABEL}] monitor stopped after ${durationMs}ms`);
        }
    }, checkIntervalMs);

    // Don't keep the process alive just for diagnostics.
    handle.unref();
};
