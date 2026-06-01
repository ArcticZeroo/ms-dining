export const throwError = (message: string): never => {
    throw new Error(message);
}

export class RetryAfterError extends Error {
    constructor(public readonly retryAfterMs: number, message?: string) {
        super(message ?? `Rate limited, retry after ${retryAfterMs}ms`);
    }
}

// Koa passes err.status through as the HTTP response code. Third-party SDK
// errors (OpenAI, Anthropic, etc.) set .status to the upstream HTTP status
// (e.g. 429 for rate limits), which leaks to the client. Re-throw as a plain
// Error so Koa defaults to 500.
export const rethrowWithoutStatus = (err: unknown): never => {
    if (err instanceof Error && 'status' in err) {
        const { status } = err as Error & { status?: unknown };
        throw new Error(`${err.constructor.name} (${status}): ${err.message}`);
    }
    throw err;
};