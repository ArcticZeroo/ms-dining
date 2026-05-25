import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { logDebug, logError } from '../../shared/util/log.js';
import { fromWire, parseServiceErrorWire, ServiceErrorWireSchema, toWire } from './errors-wire.js';
import { dispatch, RequestData, ResponseData, ServiceMap } from './service-map.js';

/**
 * Tuple shape for `sendRequest`'s tail parameter list. When the method's
 * registered parameter type is exactly `undefined` (i.e. it takes no
 * data), the trailing `data` argument is omitted entirely so callers can
 * write `handler.sendRequest('search', 'clearDuplicatedQueries')` instead
 * of forcing `... , undefined)`. For every other parameter type it's
 * required, so a method that takes `{ id: string }` still has to receive
 * one (and the type-checker rejects passing nothing).
 */
type SendRequestTail<TData> = [TData] extends [undefined] ? [data?: undefined] : [data: TData];

/**
 * Common interface every transport implementation satisfies. Typed-client
 * wrappers depend only on this, so swapping in-process for cross-thread
 * (phase 1 -> phase 2) is a one-line edit at the construction site.
 *
 * Type inference flows from the `TServices` parameter: TypeScript checks
 * that `serviceName` and `methodName` exist in the registered map, and
 * derives the expected `data` shape + the resolved value type from the
 * matching method's signature.
 */
export interface IServiceHandler<TServices extends ServiceMap> {
    sendRequest<S extends keyof TServices & string, M extends keyof TServices[S] & string>(
        serviceName: S,
        methodName: M,
        ...rest: SendRequestTail<RequestData<TServices, S, M>>
    ): Promise<ResponseData<TServices, S, M>>;
}

// ─── In-process transport ──────────────────────────────────────────────────

/**
 * Phase 1 transport: calls the registered service methods directly on the
 * current thread. Used during the migration to validate the service API
 * shape without requiring a worker thread to exist yet.
 *
 * Two intentional behaviors mirror the cross-thread transport so that
 * "works in phase 1 but breaks in phase 2" bugs are caught early:
 *
 *  1. Arguments and return values are passed through `structuredClone`. The
 *     real worker boundary uses structured cloning under the hood, so any
 *     accidental function-passing / class-instance leakage / Date round-tripping
 *     issue surfaces here. Set `cloneOverWire: false` to opt out for tests
 *     where the clone cost matters.
 *  2. Errors are routed through {@link toWire}/{@link fromWire}. A bare
 *     thrown `Error` from a service becomes a `ServiceError` with code
 *     `INTERNAL` at the caller — exactly what would happen across a real
 *     worker.
 */
export class InProcessHandler<TServices extends ServiceMap> implements IServiceHandler<TServices> {
    readonly #services: TServices;
    readonly #cloneOverWire: boolean;

    constructor(services: TServices, options: { cloneOverWire?: boolean } = {}) {
        this.#services = services;
        this.#cloneOverWire = options.cloneOverWire ?? true;
    }

    async sendRequest<S extends keyof TServices & string, M extends keyof TServices[S] & string>(
        serviceName: S,
        methodName: M,
        ...rest: SendRequestTail<RequestData<TServices, S, M>>
    ): Promise<ResponseData<TServices, S, M>> {
        const data = rest[0];
        const inputData = this.#cloneOverWire ? structuredClone(data) : data;

        let result: unknown;
        try {
            result = await dispatch(this.#services, serviceName, methodName, inputData);
        } catch (err) {
            // Round-trip through the wire format so a service that throws a
            // plain Error here behaves identically to one that throws the
            // same Error from across a real worker boundary.
            throw fromWire(toWire(err));
        }

        return (this.#cloneOverWire ? structuredClone(result) : result) as ResponseData<TServices, S, M>;
    }
}

// ─── Cross-thread transport ────────────────────────────────────────────────
//
// The worker envelopes (request + response) are defined as zod schemas so
// every cross-boundary payload is parse-validated rather than duck-typed.
// `data` is `z.unknown()` because it's whatever the service method accepts
// (or returns); type safety for the inner shape comes from the typed
// `sendRequest` signature, not from runtime validation.

const WorkerRequestSchema = z.object({
    requestId:   z.string(),
    serviceName: z.string(),
    methodName:  z.string(),
    data:        z.unknown(),
});

const WorkerResponseSuccessSchema = z.object({
    requestId: z.string(),
    success:   z.literal(true),
    data:      z.unknown(),
});

const WorkerResponseFailureSchema = z.object({
    requestId: z.string(),
    success:   z.literal(false),
    error:     ServiceErrorWireSchema,
});

const WorkerResponseSchema = z.discriminatedUnion('success', [
    WorkerResponseSuccessSchema,
    WorkerResponseFailureSchema,
]);

type WorkerRequest = z.infer<typeof WorkerRequestSchema>;
type WorkerResponseSuccess = z.infer<typeof WorkerResponseSuccessSchema>;
type WorkerResponseFailure = z.infer<typeof WorkerResponseFailureSchema>;

type PendingRequest = [resolve: (value: unknown) => void, reject: (err: Error) => void];

/**
 * Phase 2 transport: spawns a worker thread, sends each `sendRequest` as a
 * `postMessage`, and matches the response by `requestId`. Both the main
 * thread and the worker thread instantiate this class — the main side
 * spawns and posts; the worker side listens on `parentPort` and dispatches
 * through its own service map.
 *
 * Lazy worker spawn: the `Worker` is only constructed on the first
 * `sendRequest`, so test bootstraps have a chance to set env vars (like
 * `DATABASE_URL`) before the child inherits them.
 */
export class WorkerThreadHandler<TServices extends ServiceMap> implements IServiceHandler<TServices> {
    readonly #filePath: URL;
    readonly #services: TServices | undefined;
    readonly #pendingRequests = new Map<string, PendingRequest>();
    #worker: Worker | undefined;
    #unhandledMessageHandler: ((message: unknown) => boolean) | undefined;

    /**
     * @param filePath - URL of the worker entry file. Used on the main side
     *   to spawn the worker; ignored on the worker side.
     * @param services - The service map. Required inside the worker thread
     *   for dispatch, but optional on the main thread so worker-only storage
     *   code does not need to be imported there.
     */
    constructor(filePath: URL, services?: TServices) {
        this.#filePath = filePath;
        this.#services = services;

        if (!isMainThread) {
            if (services == null) {
                throw new Error('WorkerThreadHandler requires services when constructed inside a worker thread');
            }
            logDebug('WorkerThreadHandler is running in worker thread, registering listener');
            this.#registerWorkerRequestListener();
        }
    }

    start(): void {
        if (!isMainThread) {
            return;
        }

        this.#ensureWorker();
    }

    async sendRequest<S extends keyof TServices & string, M extends keyof TServices[S] & string>(
        serviceName: S,
        methodName: M,
        ...rest: SendRequestTail<RequestData<TServices, S, M>>
    ): Promise<ResponseData<TServices, S, M>> {
        if (!isMainThread) {
            throw new Error('Cannot send requests from inside the worker thread');
        }

        const data = rest[0];
        const worker = this.#ensureWorker();
        const requestId = randomUUID();

        const responsePromise = new Promise<unknown>((resolve, reject) => {
            this.#pendingRequests.set(requestId, [resolve, reject]);
        });

        const request: WorkerRequest = { requestId, serviceName, methodName, data };
        worker.postMessage(request);

        return responsePromise as Promise<ResponseData<TServices, S, M>>;
    }

    #ensureWorker(): Worker {
        if (this.#worker != null) {
            return this.#worker;
        }
        this.#worker = new Worker(this.#filePath);
        this.#registerMainThreadResponseListener(this.#worker);
        return this.#worker;
    }

    /**
     * Terminate the underlying Worker, if one was spawned. Rejects all
     * outstanding in-flight requests. After termination, calling
     * `sendRequest` will spawn a fresh worker.
     *
     * Primarily for tests and graceful shutdown; not part of `IServiceHandler`.
     */
    async terminate(): Promise<void> {
        const worker = this.#worker;
        if (worker == null) {
            return;
        }
        this.#worker = undefined;

        for (const [, [, reject]] of this.#pendingRequests) {
            reject(new Error('WorkerThreadHandler terminated before response arrived'));
        }
        this.#pendingRequests.clear();

        await worker.terminate();
    }

    setUnhandledMessageHandler(handler: ((message: unknown) => boolean) | undefined) {
        this.#unhandledMessageHandler = handler;
    }

    #registerMainThreadResponseListener(worker: Worker) {
        worker.on('message', (rawMessage: unknown) => {
            const parsed = WorkerResponseSchema.safeParse(rawMessage);
            if (!parsed.success) {
                if (this.#unhandledMessageHandler?.(rawMessage)) {
                    return;
                }
                logError('Invalid worker thread command response:', rawMessage, parsed.error.message);
                return;
            }
            const message = parsed.data;

            const pendingRequest = this.#pendingRequests.get(message.requestId);
            if (pendingRequest == null) {
                logError('Unknown worker thread response requestId:', message.requestId);
                return;
            }

            this.#pendingRequests.delete(message.requestId);
            const [resolve, reject] = pendingRequest;

            if (message.success) {
                resolve(message.data);
            } else {
                // The error field went through ServiceErrorWireSchema as part
                // of the discriminated-union parse above, so it's already
                // safe to feed directly into fromWire — no need to re-validate.
                reject(parseServiceErrorWire(message.error) ?? new Error('Worker returned malformed error payload'));
            }
        });
    }

    #registerWorkerRequestListener() {
        const services = this.#services;
        if (services == null) {
            throw new Error('WorkerThreadHandler requires services to dispatch worker requests');
        }
        if (parentPort == null) {
            throw new Error('parentPort is missing in worker thread WorkerThreadHandler');
        }
        const port = parentPort;

        port.on('message', (rawMessage: unknown) => {
            const parsed = WorkerRequestSchema.safeParse(rawMessage);
            if (!parsed.success) {
                logError('Invalid worker thread command request:', rawMessage, parsed.error.message);
                return;
            }
            const { requestId, serviceName, methodName, data } = parsed.data;

            const runHandler = async () => {
                try {
                    const responseData = await dispatch(services, serviceName, methodName, data);
                    const response: WorkerResponseSuccess = { requestId, success: true, data: responseData };
                    port.postMessage(response);
                } catch (err) {
                    const response: WorkerResponseFailure = {
                        requestId,
                        success: false,
                        error: toWire(err),
                    };
                    port.postMessage(response);
                }
            };

            runHandler().catch(err => logError('Worker thread command handler error:', err));
        });
    }
}
