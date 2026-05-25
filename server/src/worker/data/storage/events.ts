import EventEmitter from 'node:events';
import { isMainThread, parentPort } from 'node:worker_threads';
import { z } from 'zod';
import type TypedEmitter from '../../../shared/models/typed-emitter.js';
import { IGroupMembershipDirtyEvent, IMenuPublishEvent, IReviewDirtyEvent } from '../../../shared/models/storage-events.js';
import { logDebug } from '../../../shared/util/log.js';

type StorageEvents = {
    menuPublished: (diff: IMenuPublishEvent) => void;
    reviewDirty: (event: IReviewDirtyEvent) => void;
    groupMembershipDirty: (event: IGroupMembershipDirtyEvent) => void;
};

type EventSource = 'storage' | 'cache';
type StorageEventName = keyof StorageEvents;
type DataWorkerEvent = IMenuPublishEvent | IReviewDirtyEvent | IGroupMembershipDirtyEvent;

const DataWorkerEventMessageSchema = z.object({
    type: z.literal('data-worker-event'),
    source: z.enum(['storage', 'cache']),
    eventName: z.enum(['menuPublished', 'reviewDirty', 'groupMembershipDirty']),
    event: z.unknown(),
});

export type DataWorkerEventMessage = z.infer<typeof DataWorkerEventMessageSchema>;

export const STORAGE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;
export const CACHE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;

STORAGE_EVENTS.on('menuPublished', (event) => {
    logDebug(`Menu published for cafe "${event.cafe.id}" on ${event.dateString} with ${event.menu.length} stations. Added: ${event.addedStations.size}, Removed: ${event.removedStations.size}, Updated: ${event.updatedStations.size}`);
});

CACHE_EVENTS.on('menuPublished', (event) => {
    logDebug(`Cache updated for cafe "${event.cafe.id}" on ${event.dateString}`);
});

const getEventEmitter = (source: EventSource) => {
    return source === 'storage' ? STORAGE_EVENTS : CACHE_EVENTS;
};

const postWorkerEvent = (source: EventSource, eventName: StorageEventName, event: DataWorkerEvent) => {
    parentPort?.postMessage({
        type: 'data-worker-event',
        source,
        eventName,
        event,
    } satisfies DataWorkerEventMessage);
};

let dataWorkerEventBridgeRegistered = false;

export const registerDataWorkerEventBridge = () => {
    if (isMainThread || parentPort == null || dataWorkerEventBridgeRegistered) {
        return;
    }
    dataWorkerEventBridgeRegistered = true;

    STORAGE_EVENTS.on('menuPublished', event => postWorkerEvent('storage', 'menuPublished', event));
    STORAGE_EVENTS.on('reviewDirty', event => postWorkerEvent('storage', 'reviewDirty', event));
    STORAGE_EVENTS.on('groupMembershipDirty', event => postWorkerEvent('storage', 'groupMembershipDirty', event));
    CACHE_EVENTS.on('menuPublished', event => postWorkerEvent('cache', 'menuPublished', event));
    CACHE_EVENTS.on('reviewDirty', event => postWorkerEvent('cache', 'reviewDirty', event));
    CACHE_EVENTS.on('groupMembershipDirty', event => postWorkerEvent('cache', 'groupMembershipDirty', event));
};

export const tryReemitDataWorkerEvent = (message: unknown): boolean => {
    const parsed = DataWorkerEventMessageSchema.safeParse(message);
    if (!parsed.success) {
        return false;
    }

    const emitter = getEventEmitter(parsed.data.source);
    switch (parsed.data.eventName) {
        case 'menuPublished':
            emitter.emit('menuPublished', parsed.data.event as IMenuPublishEvent);
            return true;
        case 'reviewDirty':
            emitter.emit('reviewDirty', parsed.data.event as IReviewDirtyEvent);
            return true;
        case 'groupMembershipDirty':
            emitter.emit('groupMembershipDirty', parsed.data.event as IGroupMembershipDirtyEvent);
            return true;
        default:
            return false;
    }
};
