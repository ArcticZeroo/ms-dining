export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runPromiseWithRetries = async <T>(promise: (retryIndex: number) => Promise<T>, retries: number, delayMs?: number): Promise<T> => {
    for (let i = 0; i <= retries; i++) {
        try {
            return promise(i);
        } catch (err) {
            if (delayMs) {
                await pause(delayMs);
            }

            if (i === retries) {
                throw err;
            }
        }
    }
}