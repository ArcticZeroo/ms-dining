import { IMenuItemBase, IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import { ReviewStorageClient, getReviewEntityKey, getReviewEntityKeyFromParts } from '../storage/clients/review.js';
import { CACHE_EVENTS, STORAGE_EVENTS } from '../storage/events.js';
import { LockedMap } from '../../util/map.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';

const REVIEW_DATA_BY_ENTITY_KEY = new LockedMap<string /*entityKey*/, IMenuItemReviewHeader>();

// Don't want to keep reviewHeaders in scope forever.
const initialize = async () => {
	const [nameHeaders, groupHeaders] = await Promise.all([
		ReviewStorageClient.getAllReviewHeaders(),
		ReviewStorageClient.getAllReviewHeadersByGroupId()
	]);

	const allHeaders = [...nameHeaders, ...groupHeaders];

	await Promise.all(
		allHeaders.map(header => REVIEW_DATA_BY_ENTITY_KEY.update(
			header.entityKey,
			() => ({ overallRating: header.overallRating, totalReviewCount: header.totalReviewCount })
		))
	);
}

await initialize();

STORAGE_EVENTS.on('reviewDirty', (event) => {
	const entityKey = getReviewEntityKeyFromParts(event.groupId, event.menuItemNormalizedName);
	REVIEW_DATA_BY_ENTITY_KEY.delete(entityKey)
		.then(() => {
			CACHE_EVENTS.emit('reviewDirty', event);
		})
		.catch(err => {
			console.error(`Failed to delete review header for "${entityKey}":`, err);
		});
});

STORAGE_EVENTS.on('groupMembershipDirty', (event) => {
	const deletions = [
		REVIEW_DATA_BY_ENTITY_KEY.delete(`group:${event.groupId}`)
	];
	for (const normalizedName of event.memberNormalizedNames) {
		deletions.push(REVIEW_DATA_BY_ENTITY_KEY.delete(`name:${normalizedName}`));
	}
	Promise.all(deletions).catch(err => {
		console.error(`Failed to invalidate review headers for group "${event.groupId}":`, err);
	});
});

export const retrieveReviewHeaderAsync = async (menuItem: IMenuItemBase): Promise<IMenuItemReviewHeader> => {
	const entityKey = getReviewEntityKey(menuItem);
	return REVIEW_DATA_BY_ENTITY_KEY.update(
		entityKey,
		async (header) => {
			if (header != null) {
				return header;
			}
			if (menuItem.groupId) {
				return ReviewStorageClient.getReviewHeaderByGroupId(menuItem.groupId);
			}
			return ReviewStorageClient.getReviewHeaderByName(normalizeNameForSearch(menuItem.name));
		});
}