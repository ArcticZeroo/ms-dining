import { PostReviewInput } from './post-review-input.tsx';
import { ReviewStats } from './review-stats.tsx';
import { MenuItemReviewsList } from './menu-item-reviews-list.tsx';
import { IReviewDataForMenuItem } from '@msdining/common/models/review';
import React, { useMemo, useState } from 'react';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { LogInForReviewButton } from './log-in-for-review-button.tsx';

interface IMenuItemReviewsDataViewProps {
    response: IReviewDataForMenuItem;
    menuItemId: string;
}

interface IReviewStats {
    counts: Record<number, number>;
    totalCount: number;
    overallRating: number;
}

const useLocalStats = (reviewData: IReviewDataForMenuItem, localRating: number | undefined): IReviewStats => {
    return useMemo(
        () => {
            if (localRating == null || reviewData.myReview?.rating === localRating) {
                return reviewData;
            }

            const counts = { ...reviewData.counts };
            let totalCount = 0;
            let overallRating = 0;

            if (reviewData.myReview != null) {
                if (reviewData.myReview.rating in counts) {
                    counts[reviewData.myReview.rating] -= 1;
                } else {
                    console.error('missing count data for my review\'s count');
                }
            }

            counts[localRating] = (counts[localRating] ?? 0) + 1;

            for (let i = 1; i <= 10; i++) {
                if (i in counts) {
                    totalCount += counts[i]!;
                    overallRating += i * counts[i]!;
                }
            }

            if (totalCount > 0) {
                overallRating /= totalCount;
            }

            return {
                counts,
                overallRating,
                totalCount
            };
        },
        [reviewData, localRating]
    );
};

export const MenuItemReviewDataView: React.FC<IMenuItemReviewsDataViewProps> = ({ response, menuItemId }) => {
    const [localComment, setLocalComment] = useState<string>(response.myReview?.comment ?? '');
    const [localRating, setLocalRating] = useState<number>(response.myReview?.rating ?? 0);
    const [reviewId, setReviewId] = useState<string | undefined>(response.myReview?.id);
    const isLoggedIn = useIsLoggedIn();

    const stats = useLocalStats(response, localRating);

    return (
        <div className="menu-item-reviews flex">
            <div className="flex-col">
                {
                    isLoggedIn && (
                        <PostReviewInput
                            menuItemId={menuItemId}
                            comment={localComment}
                            rating={localRating}
                            reviewId={reviewId}
                            reviewPostedDate={response.myReview?.createdDate}
                            onRatingChanged={setLocalRating}
                            onCommentChanged={setLocalComment}
                            onReviewIdChanged={setReviewId}
                        />
                    )
                }
                <LogInForReviewButton/>
                <ReviewStats
                    counts={stats.counts}
                    totalCount={stats.totalCount}
                    overallRating={stats.overallRating}
                />
            </div>
            <div className="flex flex-wrap">
                <MenuItemReviewsList
                    totalCount={stats.totalCount}
                    reviewsWithComments={response.reviewsWithComments}
                    menuItemId={menuItemId}
                />
            </div>
        </div>
    );
};