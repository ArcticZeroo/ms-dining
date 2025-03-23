import { WorkerQueue } from './queue.js';
import Duration from '@arcticzeroo/duration';
import { Nullable } from '../../models/util.js';
import { createAndSaveThumbnailForMenuItem } from '../../api/cafe/image/thumbnail.js';
import { logDebug, logError } from '../../util/log.js';
import { isMainThread, parentPort } from 'node:worker_threads';
import { IThumbnailWorkerRequest } from '../../models/thumbnail-worker.js';

const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 5 });

export class ThumbnailWorkerQueue extends WorkerQueue<string, IThumbnailWorkerRequest> {
	constructor() {
		if (isMainThread) {
			throw new Error('Thumbnail worker should not be run in the main thread.');
		}

		// We're on a second thread, so may as well go zoom
		super({
			emptyPollInterval:       QUEUE_EMPTY_POLL_INTERVAL,
		});

		this.start();
	}

	protected getKey(entry: IThumbnailWorkerRequest): string {
		return entry.id;
	}

	async doWorkAsync(entry: IThumbnailWorkerRequest): Promise<void | Nullable<symbol>> {
		if (!entry.imageUrl) {
			logError('Received invalid thumbnail worker request:', entry);
			return WorkerQueue.QUEUE_SKIP_ENTRY;
		}

		try {
			const notification = await createAndSaveThumbnailForMenuItem(entry);

			if (parentPort != null) {
				parentPort.postMessage(notification);
			} else {
				logError('Thumbnail worker has no parent port to send notification to:', notification);
			}
		} catch (err) {
			logDebug('Failed to create thumbnail for menu item', entry.id, err);
			throw err;
		}

		return undefined;
	}
}