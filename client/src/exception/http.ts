/**
 * Optional structured body parsed from a failed HTTP response. Mirrors the
 * shape the server's BoD error middleware emits (`{ message, code }`) but
 * accepts arbitrary other fields. Callers can read `body.message` directly
 * via `err.message` since the constructor uses it as the Error's message.
 */
export interface HttpExceptionBody {
    message?: string;
    code?: string;
    [extra: string]: unknown;
}

export class HttpException extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly body?: HttpExceptionBody,
    ) {
        const message = body?.message ?? `Response failed with statusCode: ${statusCode}`;
        super(message);
        this.name = 'HttpException';
    }

    /** Convenience: surfaces the server-emitted error code if any (e.g. "CONCEPTS_NOT_AVAILABLE"). */
    public get code(): string | undefined {
        return this.body?.code;
    }
}
