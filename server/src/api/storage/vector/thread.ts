import { isMainThread, parentPort } from 'node:worker_threads';
import { logError } from '../../../shared/util/log.js';

const main = () => {
    if (isMainThread) {
        logError('vector/thread.ts should only be run as a worker thread');
        return;
    }

    if (!parentPort) {
        logError('parentPort is missing in vector/thread.ts');
        return;
    }
}