import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { isDuckType } from '@arcticzeroo/typeguard';
import { logDebug, logError } from '../../util/log.js';
import { logBoot } from '../../util/boot-diagnostics.js';
import { randomUUID } from 'node:crypto';

interface IWorkerCommandRequest<TKey extends string, TRequestData> {
	requestId: string;
	command: TKey;
	data: TRequestData;
}

interface IWorkerCommandResponseFailure {
	requestId: string;
	success: false;
	error: string;
}

interface IWorkerCommandResponseSuccess<TResponseData> {
	requestId: string;
	success: true;
	data: TResponseData;
}

type IWorkerCommandResponse<TResponseData> = IWorkerCommandResponseFailure | IWorkerCommandResponseSuccess<TResponseData>;

type ExtractKeys<T> = T extends Record<infer K, any> ? K : never;

type ExtractRequestMap<T extends Record<string, unknown>> = {
	[K in keyof T]: T[K] extends (data: infer R) => any ? R : never;
};

type ExtractResponseMap<T extends Record<string, unknown>> = {
	[K in keyof T]: T[K] extends (data: any) => Promise<infer R> ? R : never;
};

export class WorkerThreadCommandHandler<TCommands extends Record<string, (data: any) => Promise<any>>, TKeys extends ExtractKeys<TCommands>, TRequestValueMap extends ExtractRequestMap<TCommands>, TResponseValueMap extends ExtractResponseMap<TCommands>> {
    readonly #filePath: URL;
    readonly #commands: TCommands;
    readonly #pendingRequests = new Map<string /*requestId*/, [(data: TResponseValueMap[TKeys]) => void /*resolve*/, (error: string) => void /*reject*/]>();

    // Lazy in main-thread mode: spawning the Worker is deferred to the first
    // sendRequest() so test bootstraps have a chance to set env vars (like
    // SEARCH_DB_PATH) before the child process inherits them.
    //
    // In worker-thread mode this stays unused — the worker's request listener
    // is registered eagerly in the constructor.
    #worker: Worker | undefined;

    constructor(filePath: URL, commands: TCommands) {
        this.#filePath = filePath;
        this.#commands = commands;

        if (!isMainThread) {
            logDebug('WorkerThreadCommandHandler is running in worker thread');
            this.#registerWorkerRequestListener();
        }
    }

    #ensureMainThreadWorker(): Worker {
        if (this.#worker != null) {
            return this.#worker;
        }
        const spawnStart = performance.now();
        logBoot(`Worker spawn started: ${this.#filePath.href}`);
        this.#worker = new Worker(this.#filePath);
        logBoot(`Worker constructor returned for ${this.#filePath.href} (${Math.round(performance.now() - spawnStart)}ms)`);

        let firstMessageLogged = false;
        this.#worker.once('online', () => {
            logBoot(`Worker online: ${this.#filePath.href} (${Math.round(performance.now() - spawnStart)}ms)`);
        });
        this.#worker.on('message', () => {
            if (firstMessageLogged) {
                return;
            }
            firstMessageLogged = true;
            logBoot(`Worker first message: ${this.#filePath.href} (${Math.round(performance.now() - spawnStart)}ms)`);
        });

        this.#registerMainThreadResponseListener(this.#worker);
        return this.#worker;
    }

    #registerMainThreadResponseListener(worker: Worker) {
        worker.on('message', (message) => {
            if (!isDuckType<IWorkerCommandResponse<TResponseValueMap[TKeys]>>(message, { requestId: 'string' })) {
                logError('Invalid worker thread command response:', message);
                return;
            }

            const pendingRequest = this.#pendingRequests.get(message.requestId);
            if (pendingRequest == null) {
                logError('Invalid worker thread command response requestId:', message.requestId);
                return;
            }

            const [resolve, reject] = pendingRequest;
            this.#pendingRequests.delete(message.requestId);

            if (!message.success) {
                reject(message.error);
            } else {
                resolve(message.data);
            }
        });
    }

    #registerWorkerRequestListener() {
        if (parentPort == null) {
            throw new Error('parentPort is missing in worker thread WorkerThreadCommandHandler');
        }

        parentPort.on('message', (message) => {
            if (!isDuckType<IWorkerCommandRequest<TKeys, TRequestValueMap[TKeys]>>(message, { command: 'string', requestId: 'string' })) {
                logError('Invalid worker thread command request:', message);
                return;
            }

            const { command, requestId, data } = message;

            // logDebug('Got worker thread command', command, requestId);

            const handler = this.#commands[command];
            if (handler == null) {
                logError('Invalid worker thread command:', command);
                return;
            }

            const runHandler = async () => {
                if (parentPort == null) {
                    logError('parentPort is missing in worker thread WorkerThreadCommandHandler message handler');
                    return;
                }

                try {
                    const response = await handler(data);
                    // logDebug('Sending response for worker thread command', command, requestId);
                    parentPort.postMessage({ requestId, success: true, data: response });
                } catch (err) {
                    logError('Error processing worker thread command:', err);
                    parentPort.postMessage({ requestId, success: false, error: String(err) });
                }
            }

            runHandler()
                .catch(err => logError('Worker thread command handler error:', err));
        });
    }

    sendRequest<TKey extends TKeys>(key: TKey, data: TRequestValueMap[TKey]): Promise<TResponseValueMap[TKey]> {
        return new Promise((resolve, reject) => {
            if (!isMainThread) {
                reject(new Error('Cannot send requests from the worker thread'));
                return;
            }

            const worker = this.#ensureMainThreadWorker();
            const requestId = randomUUID();
            worker.postMessage({ requestId, command: key, data });
            this.#pendingRequests.set(requestId, [resolve as (data: any) => void, reject]);
        });
    }
}