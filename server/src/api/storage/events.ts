import EventEmitter from 'node:events';
import type TypedEmitter from '../../models/typed-emitter.js';
import { IGroupMembershipDirtyEvent, IMenuPublishEvent, IReviewDirtyEvent } from '../../models/storage-events.js';
import { logDebug, logInfo } from '../../util/log.js';

type StorageEvents = {
	menuPublished: (diff: IMenuPublishEvent) => void;
	reviewDirty: (event: IReviewDirtyEvent) => void;
	groupMembershipDirty: (event: IGroupMembershipDirtyEvent) => void;
}

// Default EventEmitter max-listeners (10) is below the legitimate set of
// menuPublished subscribers across the cache modules, so bump it explicitly
// to silence the MaxListenersExceededWarning we'd otherwise see at boot.
const EVENT_EMITTER_MAX_LISTENERS = 32;

const STORAGE_EVENTS_EMITTER = new EventEmitter();
STORAGE_EVENTS_EMITTER.setMaxListeners(EVENT_EMITTER_MAX_LISTENERS);
const CACHE_EVENTS_EMITTER = new EventEmitter();
CACHE_EVENTS_EMITTER.setMaxListeners(EVENT_EMITTER_MAX_LISTENERS);

export const STORAGE_EVENTS = STORAGE_EVENTS_EMITTER as TypedEmitter<StorageEvents>;
export const CACHE_EVENTS = CACHE_EVENTS_EMITTER as TypedEmitter<StorageEvents>;

STORAGE_EVENTS.on('menuPublished', (event) => {
    logDebug(`Menu published for cafe "${event.cafe.id}" on ${event.dateString} with ${event.menu.length} stations. Added: ${event.addedStations.size}, Removed: ${event.removedStations.size}, Updated: ${event.updatedStations.size}`);
});

CACHE_EVENTS.on('menuPublished', (event) => {
    logDebug(`Cache updated for cafe "${event.cafe.id}" on ${event.dateString}`);
});

// Once we expect all module-load subscriptions to have run, log the actual
// counts so we can spot any future listener leaks immediately.
setImmediate(() => {
    logInfo(`[Events] menuPublished listeners — storage:${STORAGE_EVENTS_EMITTER.listenerCount('menuPublished')}, cache:${CACHE_EVENTS_EMITTER.listenerCount('menuPublished')}`);
});