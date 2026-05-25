import { isMainThread } from 'node:worker_threads';
import { InProcessHandler, WorkerThreadHandler, type IServiceHandler } from '../../../worker/rpc/handler.js';
import type { DataServiceMap } from '../../../worker/data/data-services.js';
import { tryReemitDataWorkerEvent } from '../../../worker/data/storage/events.js';

export type { DataServiceMap };

const dataHandlerImpl: IServiceHandler<DataServiceMap> = isMainThread
    ? new WorkerThreadHandler<DataServiceMap>(
        new URL('../../../worker/data/entry.js', import.meta.url),
    )
    : new InProcessHandler<DataServiceMap>(
        (await import('../../../worker/data/data-services.js')).DATA_SERVICES,
    );

if (dataHandlerImpl instanceof WorkerThreadHandler) {
    dataHandlerImpl.setUnhandledMessageHandler(message => tryReemitDataWorkerEvent(message));
}

export const dataHandler: IServiceHandler<DataServiceMap> = dataHandlerImpl;

export const startDataHandler = (): void => {
    if (dataHandlerImpl instanceof WorkerThreadHandler) {
        dataHandlerImpl.start();
    }
};

export const shutdownDataHandler = async () => {
    if (dataHandlerImpl instanceof WorkerThreadHandler) {
        await dataHandlerImpl.terminate();
    }
};
