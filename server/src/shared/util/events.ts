import EventEmitter from 'node:events';
import type TypedEmitter from '../models/typed-emitter.js';
import { IGroupMembershipDirtyEvent, IMenuPublishEvent, IReviewDirtyEvent } from '../models/storage-events.js';
import { isMainThread, parentPort } from 'node:worker_threads';
import { z } from 'zod';

type StorageEvents = {
    menuPublished: (diff: IMenuPublishEvent) => void;
    reviewDirty: (event: IReviewDirtyEvent) => void;
    groupMembershipDirty: (event: IGroupMembershipDirtyEvent) => void;
};

export type StorageEventName = keyof StorageEvents;

export const STORAGE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;
export const CACHE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;

type EventSource = 'storage' | 'cache';
type DataWorkerEvent = IMenuPublishEvent | IReviewDirtyEvent | IGroupMembershipDirtyEvent;

const DataWorkerEventMessageSchema = z.object({
    type:      z.literal('data-worker-event'),
    source:    z.enum(['storage', 'cache']),
    eventName: z.enum(['menuPublished', 'reviewDirty', 'groupMembershipDirty']),
    event:     z.unknown(),
});

export type DataWorkerEventMessage = z.infer<typeof DataWorkerEventMessageSchema>;

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
        emitter.emit(parsed.data.eventName, parsed.data.event as IMenuPublishEvent);
        break;
    case 'reviewDirty':
        emitter.emit(parsed.data.eventName, parsed.data.event as IReviewDirtyEvent);
        break;
    case 'groupMembershipDirty':
        emitter.emit(parsed.data.eventName, parsed.data.event as IGroupMembershipDirtyEvent);
        break;
    }
    return true;
};