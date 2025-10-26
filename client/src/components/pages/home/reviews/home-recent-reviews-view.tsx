import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../../api/dining.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { MenuItemReview } from '../../../reviews/menu-item-review.tsx';
import { toDateString } from '@msdining/common/util/date-util';

export const HomeRecentReviewsView = () => {
    const response = useImmediatePromiseState(DiningClient.getRecentReviews);

    if (response.stage === PromiseStage.error) {
        return (
            <div className="card flex-col">
                <span>
                    Couldn't load recent reviews!
                </span>
                <RetryButton onClick={response.run}/>
            </div>
        );
    }

    if (response.value != null) {
        return (
            <div className="flex horizontal-scroll">
                {
                    response.value.map(review => (
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
                    userId: '',
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