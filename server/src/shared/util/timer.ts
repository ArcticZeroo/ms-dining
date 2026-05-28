import { setInterval } from 'node:timers';
import Duration from '@arcticzeroo/duration';

export const weakSetInterval = <T extends WeakKey>(target: T, interval: Duration, onTick: (value: T) => void) => {
    if (target == null) {
        throw new Error('Cannot create weakSetInterval with null or undefined target');
    }

    const weakObject = new WeakRef(target);

    const timer = setInterval(() => {
        const maybeObject = weakObject.deref();
        if (maybeObject == null) {
            clearInterval(timer);
            return;
        }

        onTick(maybeObject);
    }, interval.inMilliseconds);
}