import { IReview } from '@msdining/common/models/review';
import { toDateString } from '@msdining/common/util/date-util';

export interface IServerReview {
	id: string;
	rating: number;
	comment: string | null;
	displayName: string | null;
	createdAt: Date;
	userId: string | null;
	menuItemId: string | null;
	stationId: string | null;
	user: {
		displayName: string;
	} | null;
	menuItem: {
		name: string;
		normalizedName: string;
		groupId: string | null;
		entityKey: string;
		cafe: {
			id: string;
		};
	} | null;
	station: {
		name: string;
		normalizedName: string;
		groupId: string | null;
		entityKey: string;
		cafe: {
			id: string;
		};
	} | null;
}

export const serializeReview = (review: IServerReview): IReview => ({
    id:              review.id,
    userId:          review.userId || undefined,
    userDisplayName: review.displayName ?? review.user?.displayName ?? 'Anonymous',
    menuItemId:      review.menuItemId || undefined,
    menuItemName:    review.menuItem?.name,
    stationId:       review.stationId || undefined,
    stationName:     review.station?.name,
    cafeId:          review.menuItem?.cafe.id ?? review.station?.cafe.id ?? '',
    rating:          review.rating,
    comment:         review.comment || undefined,
    createdDate:     toDateString(review.createdAt),
});
