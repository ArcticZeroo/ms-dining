export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runPromiseWithRetries = async <T>(promise: (retryIndex: number) => Promise<T>, retries: number, delayMs?: number, cancellation?: ICancellationToken): Promise<T> => {
    for (let i = 0; i <= retries; i++) {
        if (cancellation?.isCancelled) {
            throw new PromiseCancelledException();
        }

        try {
            return await promise(i);
        } catch (err) {
            if (cancellation?.isCancelled) {
                throw err;
            }

            if (i < retries && delayMs) {
                await pause(delayMs);
            }

            if (i === retries) {
                throw err;
            }
        }
    }

    throw new Error('Request failed! Should be unreachable');
}

export interface ICancellationToken {
    isCancelled: boolean;
}

export class PromiseCancelledException extends Error {
    constructor(message: string = 'Promise was cancelled') {
        super(message);
        this.name = 'PromiseCancelledException';
    }
}
