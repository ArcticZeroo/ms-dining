import EventEmitter from 'node:events';
import type TypedEmitter from '../../models/typed-emitter.js';
import { IMenuPublishEvent } from '../../models/storage-events.js';

type StorageEvents = {
	menuPublished: (diff: IMenuPublishEvent) => void;
}

export const STORAGE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;
export const CACHE_EVENTS = new EventEmitter() as TypedEmitter<StorageEvents>;