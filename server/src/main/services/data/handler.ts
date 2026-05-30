import { WorkerThreadHandler, type IServiceHandler } from '../../../worker/rpc/handler.js';
import type { DataServiceMap } from '../../../shared/services/data-service-contract.generated.js';
import { getDbPriority } from '../../../shared/util/db-priority.js';
import { tryReemitDataWorkerEvent } from '../../../shared/util/events.js';

export type { DataServiceMap };

// This module is only imported on the main thread (via production.ts).
// The worker thread uses its own entry.ts with an InProcessHandler.
const dataHandlerImpl = new WorkerThreadHandler<DataServiceMap>(
    new URL('../../../worker/data/entry.js', import.meta.url),
    undefined,
    { getRequestMetadata: () => ({ dbPriority: getDbPriority() }) },
);

dataHandlerImpl.setUnhandledMessageHandler(message => tryReemitDataWorkerEvent(message));

export const dataHandler: IServiceHandler<DataServiceMap> = dataHandlerImpl;

export const startDataHandler = (): void => {
    dataHandlerImpl.start();
};

export const shutdownDataHandler = async () => {
    await dataHandlerImpl.terminate();
};
