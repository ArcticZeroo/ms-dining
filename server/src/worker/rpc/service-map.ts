import { ServiceError, SERVICE_ERROR_CODES } from './errors.js';

/**
 * Shape of every leaf method registered with the handler. Methods take
 * exactly one structuredClone-safe argument and return a Promise of a
 * structuredClone-safe value.
 *
 * Why one argument: keeps the wire envelope shape uniform (a single `data`
 * field) and trivially serializable. Callers who want multiple positional
 * arguments wrap them in an object literal at the call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServiceMethod = (data: any) => Promise<unknown>;

/**
 * A single service exposed across the boundary. Each property is one
 * method on the service.
 */
export type ServiceMethods = Record<string, ServiceMethod>;

/**
 * The full set of services registered with a handler.
 *
 * Concrete service maps often come from named interfaces rather than
 * `{ [key: string]: ... }` records, so this stays intentionally broad and
 * the per-method validation happens through {@link RequestData} and
 * {@link ResponseData}.
 */
export type ServiceMap = object;

/**
 * The data type accepted by `services[S][M]`. Used by `sendRequest` to
 * constrain the `data` argument to match the registered method signature.
 */
export type RequestData<
    TServices extends ServiceMap,
    S extends keyof TServices,
    M extends keyof TServices[S],
> = TServices[S][M] extends (...args: infer TArgs) => Promise<unknown>
    ? TArgs extends []
        ? undefined
        : TArgs[0]
    : never;

/**
 * The value resolved by `services[S][M]` (unwrapping the returned Promise).
 * Used by `sendRequest` for its return type so the typed-client wrappers
 * inherit the worker-side return type with no manual annotations.
 */
export type ResponseData<
    TServices extends ServiceMap,
    S extends keyof TServices,
    M extends keyof TServices[S],
> = TServices[S][M] extends (...args: any[]) => Promise<infer TResult> ? TResult : never;

/**
 * Walk the service map and invoke the named method. Centralizes the
 * "unknown service / unknown method" handling so both the in-process and
 * worker-thread handlers behave identically when given a bad command.
 *
 * Throws a {@link ServiceError} with code `BAD_REQUEST` for unknown
 * commands so the failure surfaces as a proper structured error rather
 * than a plain Error swallowed by the cross-boundary wrapping.
 */
export const dispatch = async <TServices extends ServiceMap>(
    services: TServices,
    serviceName: string,
    methodName: string,
    data: unknown,
): Promise<unknown> => {
    const service = services[serviceName as keyof TServices];
    if (service == null || typeof service !== 'object') {
        throw new ServiceError(
            SERVICE_ERROR_CODES.BAD_REQUEST,
            `Unknown service: "${serviceName}"`,
        );
    }

    const method = (service as ServiceMethods)[methodName];
    if (method == null) {
        throw new ServiceError(
            SERVICE_ERROR_CODES.BAD_REQUEST,
            `Unknown method: "${serviceName}.${methodName}"`,
        );
    }

    return method(data);
};
