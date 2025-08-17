import { IMenuItemReviewHeader } from '@msdining/common/dist/models/cafe.js';
import { ReviewStorageClient } from '../storage/clients/review.js';
import { STORAGE_EVENTS } from '../storage/events.js';
import { LockedMap } from '../../util/map.js';

const REVIEW_DATA_BY_NAME = new LockedMap<string /*normalizedName*/, IMenuItemReviewHeader>();

// Don't want to keep reviewHeaders in scope forever.
const initialize = async () => {
	const reviewHeaders = await ReviewStorageClient.getAllReviewHeaders();

	await Promise.all(
		reviewHeaders.map(header => REVIEW_DATA_BY_NAME.update(
			header.menuItemNormalizedName,
			() => ({ overallRating: header.overallRating, totalReviewCount: header.totalReviewCount })
		))
	);
}

await initialize();

STORAGE_EVENTS.on('reviewDirty', ({ menuItemNormalizedName }) => {
	REVIEW_DATA_BY_NAME.delete(menuItemNormalizedName).catch(err => {
		console.error(`Failed to delete review header for "${menuItemNormalizedName}":`, err);
	});
});

export const retrieveReviewHeaderAsync = async (normalizedName: string): Promise<IMenuItemReviewHeader | undefined> => {
	return REVIEW_DATA_BY_NAME.update(
		normalizedName,
		async (header) => {
			return header ?? await ReviewStorageClient.getReviewHeader(normalizedName);
		});
}