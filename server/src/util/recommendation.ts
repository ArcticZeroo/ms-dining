import { IMenuItemBase, IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import {
	IRecommendationItem,
	IRecommendationSection,
} from '@msdining/common/models/recommendation';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { Nullable } from '@msdining/common/models/util';

export interface IAvailableMenuItem {
	menuItem: IMenuItemBase;
	cafeId: string;
	cafeName: string;
	stationName: string;
}

export const toRecommendationItem = (
	available: IAvailableMenuItem,
	score: number,
	reason?: string,
	reviewHeader?: Nullable<IMenuItemReviewHeader>,
): IRecommendationItem => ({
	menuItemId:       available.menuItem.id,
	name:             available.menuItem.name,
	groupId:          available.menuItem.groupId ?? undefined,
	description:      available.menuItem.description ?? undefined,
	imageUrl:         available.menuItem.imageUrl ?? undefined,
	price:            available.menuItem.price,
	calories:         available.menuItem.calories,
	cafeId:           available.cafeId,
	cafeName:         available.cafeName,
	stationName:      available.stationName,
	tags:             available.menuItem.tags.size > 0 ? Array.from(available.menuItem.tags) : undefined,
	overallRating:    reviewHeader?.overallRating,
	totalReviewCount: reviewHeader?.totalReviewCount,
	reason,
	score,
});

export const deduplicateItems = (
	sections: IRecommendationSection[],
): IRecommendationSection[] => {
	const seenEntityKeys = new Set<string>();
	return sections.map(section => ({
		...section,
		items: section.items.filter(item => {
			const entityKey = getEntityKey(item);
			if (seenEntityKeys.has(entityKey)) {
				return false;
			}
			seenEntityKeys.add(entityKey);
			return true;
		}),
	})).filter(section => section.items.length > 0);
};

const RATING_WEIGHT = 0.6;
const COUNT_WEIGHT = 0.4;

export const computePopularityScore = (overallRating: number, totalReviewCount: number): number =>
	(overallRating / 10) * RATING_WEIGHT +
	Math.log(totalReviewCount + 1) * COUNT_WEIGHT;
