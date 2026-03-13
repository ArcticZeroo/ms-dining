import { IMenuItemBase, IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import { IRecommendationItem, IRecommendationSection, } from '@msdining/common/models/recommendation';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { Nullable } from '@msdining/common/models/util';

export interface IMenuItemCandidate {
	menuItem: IMenuItemBase;
	cafeId: string;
	cafeName: string;
	stationName: string;
}

export const toRecommendationItem = (
    item: IMenuItemCandidate,
    score: number,
    reason?: string,
    reviewHeader?: Nullable<IMenuItemReviewHeader>,
): IRecommendationItem => ({
    menuItemId:       item.menuItem.id,
    name:             item.menuItem.name,
    groupId:          item.menuItem.groupId ?? undefined,
    description:      item.menuItem.description ?? undefined,
    imageUrl:         item.menuItem.imageUrl ?? undefined,
    price:            item.menuItem.price,
    calories:         item.menuItem.calories,
    cafeId:           item.cafeId,
    cafeName:         item.cafeName,
    stationName:      item.stationName,
    tags:             item.menuItem.tags.size > 0 ? Array.from(item.menuItem.tags) : undefined,
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
