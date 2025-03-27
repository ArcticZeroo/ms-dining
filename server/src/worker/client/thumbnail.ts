import { Worker } from 'node:worker_threads';
import { IThumbnailWorkerCompletionNotification, IThumbnailWorkerRequest } from '../../models/thumbnail.js';
import { isDuckType } from '@arcticzeroo/typeguard';
import { logError } from '../../util/log.js';
import { MenuItemStorageClient } from '../../api/storage/clients/menu-item.js';
import { IMenuItem } from '@msdining/common/dist/models/cafe.js';
import { ICafeStation } from '../../models/cafe.js';

const thumbnailWorker = new Worker(new URL('../thread/thumbnail-worker.js', import.meta.url));

const handleThumbnailWorkerCompletionAsync = async (message: IThumbnailWorkerCompletionNotification) => {
	const menuItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(message.id);
	if (menuItem == null) {
		logError('Received thumbnail completion notification for unknown menu item:', message.id);
		return;
	}

	menuItem.thumbnailWidth = message.thumbnailWidth;
	menuItem.thumbnailHeight = message.thumbnailHeight;
	menuItem.hasThumbnail = true;
}

thumbnailWorker.on('message', (message) => {
	if (!isDuckType<IThumbnailWorkerCompletionNotification>(message, {
		id:              'string',
		thumbnailWidth:  'number',
		thumbnailHeight: 'number'
	})) {
		logError('Received invalid message from thumbnail worker:', message);
		return;
	}

	handleThumbnailWorkerCompletionAsync(message)
		.catch((err) => logError('Failed to handle thumbnail worker completion:', err));
});

export const queueMenuItemThumbnail = (menuItem: IMenuItem) => {
	if (!menuItem.imageUrl || (menuItem.hasThumbnail && menuItem.thumbnailWidth != null && menuItem.thumbnailHeight != null)) {
		return;
	}

	const request: IThumbnailWorkerRequest = {
		id:             menuItem.id,
		imageUrl:       menuItem.imageUrl,
		lastUpdateTime: menuItem.lastUpdateTime,
	};

	thumbnailWorker.postMessage(request);
}

export const queueMenuItemThumbnailFromMenu = (stations: ICafeStation[]) => {
	for (const station of stations) {
		for (const menuItem of station.menuItemsById.values()) {
			queueMenuItemThumbnail(menuItem);
		}
	}
}