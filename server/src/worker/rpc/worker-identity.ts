import { workerData } from 'node:worker_threads';

/**
 * Returns true if the current worker thread was spawned with this
 * module as its entry point. Returns false when the module is merely
 * imported as a dependency inside another worker.
 */
export const isWorkerEntryModule = (entryUrl: URL): boolean =>
    workerData?.__handlerEntryUrl === entryUrl.href;
