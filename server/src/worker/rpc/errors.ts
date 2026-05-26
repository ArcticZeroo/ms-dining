/**
 * Typed error codes for service responses. Used by the service layer to signal
 * categorical failures (not found, bad request, etc.) so the HTTP layer can
 * translate to status codes without each route having to inspect error
 * messages.
 *
 * Why an explicit string-literal union + matching const object instead of an
 * `enum`:
 *  - Survives type erasure cleanly (tsx --no-type-check, future native Node
 *    type stripping, swc). `enum` emits a runtime object that no longer makes
 *    sense in those environments.
 *  - The literal union is the source of truth and reads obviously at
 *    declaration site. No reverse-inference via `typeof X[keyof typeof X]`.
 *  - Wire format carries the value as a plain string with no extra runtime
 *    state to maintain.
 *
 * The matching value object {@link SERVICE_ERROR_CODES} uses a mapped type
 * `{ [K in ServiceErrorCode]: K }` so every key maps to its own literal —
 * catching typos like `NOT_FOUND: 'NOTFOUND'` at compile time.
 */
export type ServiceErrorCode =
    | 'NOT_FOUND'
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'CONFLICT'
    | 'RATE_LIMITED'
    | 'UPSTREAM_FAIL'
    | 'INTERNAL';

export const SERVICE_ERROR_CODES: { [K in ServiceErrorCode]: K } = {
    NOT_FOUND:     'NOT_FOUND',
    BAD_REQUEST:   'BAD_REQUEST',
    UNAUTHORIZED:  'UNAUTHORIZED',
    FORBIDDEN:     'FORBIDDEN',
    CONFLICT:      'CONFLICT',
    RATE_LIMITED:  'RATE_LIMITED',
    UPSTREAM_FAIL: 'UPSTREAM_FAIL',
    INTERNAL:      'INTERNAL',
};

/**
 * Thrown from inside a service method to communicate a categorical failure
 * back to the caller. The cross-thread handler serializes via
 * {@link toWire}/{@link fromWire} so the structured information survives
 * a worker boundary (or, eventually, an inter-process boundary).
 *
 * `details` is `unknown` — the wire format only round-trips structuredClone-
 * safe values. Callers should not put functions, class instances, or other
 * non-cloneable objects there.
 */
export class ServiceError extends Error {
    public readonly code: ServiceErrorCode;
    public readonly details?: unknown;

    constructor(code: ServiceErrorCode, message: string, details?: unknown) {
        super(message);
        this.name = 'ServiceError';
        this.code = code;
        this.details = details;
    }
}
