import { Nullable } from './util.js';

export interface IThumbnailData {
	thumbnailWidth: number;
	thumbnailHeight: number;
	lastUpdateTime?: Date;
}

export interface IThumbnailDoesExistData extends IThumbnailData {
	hasThumbnail: true;
}

export interface IThumbnailDoesNotExistData {
	hasThumbnail: false;
}

export type IThumbnailExistenceData = IThumbnailDoesExistData | IThumbnailDoesNotExistData;

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