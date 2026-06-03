import { RetryButton } from '../../../button/retry-button.tsx';
import { ReviewCard } from '../../../reviews/review-card.tsx';
import { toDateString } from '@msdining/common/util/date-util';
import { useRecentReviews } from '../../../../store/queries/reviews.ts';

export const HomeRecentReviewsView = () => {
    const { isError, data, refetch } = useRecentReviews();

    if (isError) {
        return (
            <div className="card flex-col">
                <span>
                    Couldn't load recent reviews!
                </span>
                <RetryButton onClick={() => refetch()}/>
            </div>
        );
    }

    if (data != null) {
        return (
            <div className="flex horizontal-scroll">
                {
                    data.map(review => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            showMyself={true}
                            stretchSelf={true}
                            showCommentInline={false}
                        />
                    ))
                }
            </div>
        );
    }

    return (
        <div className="flex horizontal-scroll loading-skeleton">
            <ReviewCard
                review={{
                    id: 'loading',
                    userDisplayName: '...',
                    cafeId: '',
                    rating: 5,
                    createdDate: toDateString(new Date())
                }}
                showCommentInline={false}
                showMyself={true}
                isSkeleton={true}
            />
        </div>
    );
}