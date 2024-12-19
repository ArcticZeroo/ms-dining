import { WorkerQueue } from './queue.js';
import { IMenuItem } from '@msdining/common/dist/models/cafe.js';
import Duration from '@arcticzeroo/duration';
import { Nullable } from '../models/util.js';
import { createAndSaveThumbnailForMenuItem } from '../api/cafe/image/thumbnail.js';
import { logDebug } from '../util/log.js';
import { ICafeStation } from '../models/cafe.js';

const QUEUE_SUCCESS_POLL_INTERVAL = new Duration({ milliseconds: 100 });
const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 15 });
const QUEUE_FAILED_POLL_INTERVAL = new Duration({ seconds: 1 });

class ThumbnailWorkerQueue extends WorkerQueue<string, IMenuItem> {
	constructor() {
		super({
			successPollInterval:     QUEUE_SUCCESS_POLL_INTERVAL,
			emptyPollInterval:       QUEUE_EMPTY_POLL_INTERVAL,
			failedPollInterval:      QUEUE_FAILED_POLL_INTERVAL,
		});

		this.start();
	}

	protected getKey(entry: IMenuItem): string {
		return entry.id;
	}

	async doWorkAsync(entry: IMenuItem): Promise<void | Nullable<symbol>> {
		if (!entry.imageUrl || entry.hasThumbnail) {
			logDebug('Skipping thumbnail creation for menu item:', entry.name, ', hasThumbnail=', entry.hasThumbnail);
			return WorkerQueue.QUEUE_SKIP_ENTRY;
		}

		logDebug('Creating thumbnail for menu item:', entry.name);
		try {
			await createAndSaveThumbnailForMenuItem(entry);
			entry.hasThumbnail = true;
		} catch (err) {
			logDebug('Failed to create thumbnail for menu item:', entry.name, err);
			entry.hasThumbnail = false;
			throw err;
		}

		return undefined;
	}

	public addFromMenu(stations: ICafeStation[]) {
		for (const station of stations) {
			for (const menuItem of station.menuItemsById.values()) {
				if (menuItem.imageUrl) {
					THUMBNAIL_WORKER_QUEUE.add(menuItem);
				}
			}
		}
	}
}

export const THUMBNAIL_WORKER_QUEUE = new ThumbnailWorkerQueue();