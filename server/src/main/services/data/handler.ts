import { WorkerThreadHandler, type IServiceHandler } from '../../../worker/rpc/handler.js';
import type { DataServiceMap } from '../../../worker/data/data-services.js';
import { tryReemitDataWorkerEvent } from '../../../worker/data/storage/events.js';

export type { DataServiceMap };

// This module is only imported on the main thread (via production.ts).
// The worker thread uses its own entry.ts with an InProcessHandler.
const dataHandlerImpl = new WorkerThreadHandler<DataServiceMap>(
    new URL('../../../worker/data/entry.js', import.meta.url),
);

dataHandlerImpl.setUnhandledMessageHandler(message => tryReemitDataWorkerEvent(message));

export const dataHandler: IServiceHandler<DataServiceMap> = dataHandlerImpl;

export const startDataHandler = (): void => {
    dataHandlerImpl.start();
};

export const shutdownDataHandler = async () => {
    await dataHandlerImpl.terminate();
};
