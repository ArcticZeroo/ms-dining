import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { isDuckType } from '@arcticzeroo/typeguard';
import { logDebug, logError } from '../../util/log.js';
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
	readonly #worker: Worker | undefined;
	readonly #commands: TCommands;
	readonly #pendingRequests = new Map<string /*requestId*/, [(data: TResponseValueMap[TKeys]) => void /*resolve*/, (error: string) => void /*reject*/]>();

	constructor(filePath: URL, commands: TCommands) {
		this.#commands = commands;

		if (isMainThread) {
			this.#worker = new Worker(filePath);
			this.#registerMainThreadResponseListener();
		} else {
			logDebug('WorkerThreadCommandHandler is running in worker thread');
			this.#registerWorkerRequestListener();
		}
	}

	#registerMainThreadResponseListener() {
		if (this.#worker == null) {
			throw new Error('Worker is missing in main thread WorkerThreadCommandHandler');
		}

		this.#worker.on('message', (message) => {
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

			// logDebug('Got response for worker thread command id', message.requestId, message.success ? 'success' : 'failure');
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
			if (!this.#worker) {
				reject(new Error('Cannot send requests from the worker thread'));
				return;
			}

			const requestId = randomUUID();
			this.#worker.postMessage({ requestId, command: key, data });
			this.#pendingRequests.set(requestId, [resolve as (data: any) => void, reject]);
		});
	}
}