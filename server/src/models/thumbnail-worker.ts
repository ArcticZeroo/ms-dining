import { Nullable } from './util.js';

export interface IThumbnailWorkerRequest {
	id: string;
	imageUrl: string;
	lastUpdateTime?: Nullable<Date>;
}

export interface IThumbnailWorkerCompletionNotification {
	id: string;
	thumbnailWidth: number;
	thumbnailHeight: number;
}