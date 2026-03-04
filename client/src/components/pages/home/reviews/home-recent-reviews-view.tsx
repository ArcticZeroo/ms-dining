import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { RetryButton } from '../../../button/retry-button.tsx';
import { MenuItemReview } from '../../../reviews/menu-item-review.tsx';
import { toDateString } from '@msdining/common/util/date-util';
import { REVIEW_STORE } from '../../../../store/reviews.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';

export const HomeRecentReviewsView = () => {
    const { stage, value, run } = useValueNotifier(REVIEW_STORE.recentReviews);

    if (stage === PromiseStage.error) {
        return (
            <div className="card flex-col">
                <span>
                    Couldn't load recent reviews!
                </span>
                <RetryButton onClick={run}/>
            </div>
        );
    }

    if (value != null) {
        return (
            <div className="flex horizontal-scroll">
                {
                    value.map(review => (
                        <MenuItemReview
                            key={review.id}
                            review={review}
                            showMyself={true}
                            stretchSelf={true}
                        />
                    ))
                }
            </div>
        );
    }

    return (
        <div className="flex horizontal-scroll loading-skeleton">
            <MenuItemReview
                review={{
                    id: 'loading',
                    userDisplayName: '...',
                    menuItemId: '',
                    menuItemName: '...',
                    cafeId: '',
                    rating: 5,
                    createdDate: toDateString(new Date())
                }}
                showMyself={true}
                isSkeleton={true}
            />
        </div>
    );
}