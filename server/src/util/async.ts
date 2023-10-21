export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runPromiseWithRetries = async <T>(promise: () => Promise<T>, retries: number, delayMs?: number): Promise<T> => {
    for (let i = 0; i <= retries; i++) {
        try {
            return promise();
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