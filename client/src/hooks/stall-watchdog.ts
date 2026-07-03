import { useCallback, useEffect, useRef, useState } from 'react';

interface IStallWatchdog {
    isStalled: boolean;
    arm: () => void;
    disarm: () => void;
}

/**
 * A one-shot timeout you can arm and disarm imperatively. `isStalled` flips to
 * true if `timeoutMs` elapses after the most recent `arm()` without a `disarm()`.
 *
 * Both `arm()` and `disarm()` reset `isStalled` back to false — arming means
 * "activity is happening, watch for a stall", disarming means "we got a result,
 * stop watching". Useful for surfacing an advisory notice when something that
 * should respond promptly (e.g. a payment iframe) goes silent.
 */
export const useStallWatchdog = (timeoutMs: number): IStallWatchdog => {
    const [isStalled, setIsStalled] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = undefined;
        }
    }, []);

    const disarm = useCallback(() => {
        clearTimer();
        setIsStalled(false);
    }, [clearTimer]);

    const arm = useCallback(() => {
        clearTimer();
        setIsStalled(false);
        timerRef.current = setTimeout(() => setIsStalled(true), timeoutMs);
    }, [clearTimer, timeoutMs]);

    // Stop the timer if the consumer unmounts mid-wait.
    useEffect(() => clearTimer, [clearTimer]);

    return { isStalled, arm, disarm };
};
