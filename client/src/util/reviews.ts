import { truncateFloat } from '@msdining/common/util/number-util';
import { pluralize } from './string.js';

export const formatReviewScore = (overallRating: number, totalReviewCount: number) => {
    return `${truncateFloat(overallRating / 2, 2)} ⭐ (${totalReviewCount} ${pluralize('review', totalReviewCount)})`;
}