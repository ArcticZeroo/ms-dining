import { isMainThread, parentPort } from 'node:worker_threads';
import { logError, logInfo } from '../../util/log.js';
import { isDuckType } from '@arcticzeroo/typeguard';
import { IThumbnailWorkerRequest } from '../../models/thumbnail.js';
import { ThumbnailWorkerQueue } from '../queues/thumbnail.js';

const queue = new ThumbnailWorkerQueue();

const main = () => {
	if (isMainThread) {
		logError('Thumbnail worker should not be run in the main thread. Skipping work.');
		return;
	}

	if (parentPort == null) {
		logError('Thumbnail worker should have a parent port. Skipping work.');
		return;
	}

	logInfo('Thumbnail worker thread started');

	parentPort.on('message', (message) => {
		if (!isDuckType<IThumbnailWorkerRequest>(message, { id: 'string', imageUrl: 'string' })) {
			logError('Received invalid message in Thumbnail worker:', message);
		}

		queue.add(message);
	});
}

main();