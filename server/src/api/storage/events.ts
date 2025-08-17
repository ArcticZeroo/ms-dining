import EventEmitter from 'node:events';
import type TypedEmitter from '../../models/typed-emitter.js';
import { IMenuPublishEvent, IReviewDirtyEvent } from '../../models/storage-events.js';
import { logDebug } from '../../util/log.js';

type StorageEvents = {
	menuPublished: (diff: IMenuPublishEvent) => void;
	reviewDirty: (event: IReviewDirtyEvent) => void;
}

export const STORAGE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;
export const CACHE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;

STORAGE_EVENTS.on('menuPublished', (event) => {
	logDebug(`Menu published for cafe "${event.cafe.id}" on ${event.dateString} with ${event.menu.length} stations. Added: ${event.addedStations.size}, Removed: ${event.removedStations.size}, Updated: ${event.updatedStations.size}`);
});

CACHE_EVENTS.on('menuPublished', (event) => {
	logDebug(`Cache updated for cafe "${event.cafe.id}" on ${event.dateString}`);
});