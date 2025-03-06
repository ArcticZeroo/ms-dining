import { isMainThread } from 'node:worker_threads';
import { logError } from '../../util/log.js';

const main = () => {
    if (isMainThread) {
        logError('Embeddings worker should not be run in the main thread. Skipping work.');
        return;
    }
}

main();
