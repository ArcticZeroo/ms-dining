import EventEmitter from 'node:events';
import type TypedEmitter from '../models/typed-emitter.js';
import { IGroupMembershipDirtyEvent, IMenuPublishEvent, IReviewDirtyEvent } from '../models/storage-events.js';

type StorageEvents = {
    menuPublished: (diff: IMenuPublishEvent) => void;
    reviewDirty: (event: IReviewDirtyEvent) => void;
    groupMembershipDirty: (event: IGroupMembershipDirtyEvent) => void;
};

export type StorageEventName = keyof StorageEvents;

export const STORAGE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;
export const CACHE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;