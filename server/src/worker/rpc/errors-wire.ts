import { z } from 'zod';
import { ServiceError, ServiceErrorCode, SERVICE_ERROR_CODES } from '../../shared/rpc/errors.js';

/**
 * Wire format for a ServiceError crossing a worker (or process) boundary.
 *
 * The schema is the source of truth for both the type and the validator.
 * `details` is intentionally `z.unknown()` so callers can attach arbitrary
 * structuredClone-safe data; we don't try to constrain its shape here.
 *
 * The `code` enum derives its members from {@link SERVICE_ERROR_CODES} via
 * a runtime `Object.keys` cast — keeping the codes in one place. The cast
 * is safe because `SERVICE_ERROR_CODES` is typed as
 * `{ [K in ServiceErrorCode]: K }`, so its keys are exactly the codes.
 */
const SERVICE_ERROR_CODE_VALUES = Object.keys(SERVICE_ERROR_CODES) as [ServiceErrorCode, ...ServiceErrorCode[]];

export const ServiceErrorWireSchema = z.object({
    kind:    z.literal('ServiceError'),
    // Unknown codes downgrade to INTERNAL so a newer worker that introduces
    // a code an older main hasn't deployed yet doesn't lose the entire
    // error — main still sees the message and stack, just with a generic code.
    code:    z.enum(SERVICE_ERROR_CODE_VALUES).catch(SERVICE_ERROR_CODES.INTERNAL),
    message: z.string(),
    details: z.unknown().optional(),
    stack:   z.string().optional(),
});

export type ServiceErrorWire = z.infer<typeof ServiceErrorWireSchema>;

/**
 * Convert any thrown value into the {@link ServiceErrorWire} shape. Unknown
 * errors (anything not a `ServiceError`) collapse to `INTERNAL` so the
 * receiving side always sees a typed code — the caller decides whether
 * they want to expose the underlying message.
 */
export const toWire = (err: unknown): ServiceErrorWire => {
    if (err instanceof ServiceError) {
        return {
            kind:    'ServiceError',
            code:    err.code,
            message: err.message,
            details: err.details,
            stack:   err.stack,
        };
    }

    if (err instanceof Error) {
        return {
            kind:    'ServiceError',
            code:    SERVICE_ERROR_CODES.INTERNAL,
            message: err.message,
            stack:   err.stack,
        };
    }

    return {
        kind:    'ServiceError',
        code:    SERVICE_ERROR_CODES.INTERNAL,
        message: String(err),
    };
};

/**
 * Reconstruct a {@link ServiceError} from its wire form. Preserves the
 * original code, message, optional details, and stack so the caller sees
 * something close to what was thrown on the other side of the boundary.
 *
 * Assumes `wire` has already been validated (e.g. via {@link parseServiceErrorWire}).
 * If you're unsure whether the payload is well-formed, use
 * {@link parseServiceErrorWire} which validates and reconstructs in one call.
 */
export const fromWire = (wire: ServiceErrorWire): ServiceError => {
    const error = new ServiceError(wire.code, wire.message, wire.details);
    if (wire.stack) {
        error.stack = wire.stack;
    }
    return error;
};

/**
 * Validate an incoming wire payload and reconstruct a {@link ServiceError}
 * in one call. Returns `null` if the payload doesn't match the schema —
 * callers can then surface a generic transport-level error instead of
 * forwarding a malformed payload.
 */
export const parseServiceErrorWire = (value: unknown): ServiceError | null => {
    const result = ServiceErrorWireSchema.safeParse(value);
    if (!result.success) {
        return null;
    }
    return fromWire(result.data);
};

/**
 * Type predicate variant for callers that need a discriminator without
 * reconstructing the error. Prefer {@link parseServiceErrorWire} when you
 * actually want the resulting `ServiceError`.
 */
export const isServiceErrorWire = (value: unknown): value is ServiceErrorWire => {
    return ServiceErrorWireSchema.safeParse(value).success;
};
