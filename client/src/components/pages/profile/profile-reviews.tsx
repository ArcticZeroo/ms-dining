import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { MenuItemReview } from '../../reviews/menu-item-review.tsx';

export const ProfileReviews = () => {
    const reviews = useImmediatePromiseState(DiningClient.retrieveMyReviews);

    if (reviews.stage === PromiseStage.error) {
        return (
            <div className="card error">
                <span>
                    Unable to load your reviews!
                </span>
                <RetryButton onClick={reviews.run}/>
            </div>
        );
    }

    if (reviews.value == null) {
        return (
            <div className="card">
                <span>
                    Loading your reviews...
                </span>
                <HourglassLoadingSpinner/>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="title">
                Your Reviews
            </div>
            {
                reviews.value.length === 0 && (
                    <div>
                        You haven't left any reviews yet. Click on any menu item to leave a review.
                    </div>
                )
            }
            {
                reviews.value.length > 0 && (
                    <div className="flex-col">
                        {
                            reviews.value.map(review => (
                                <MenuItemReview
                                    key={review.id}
                                    review={review}/>
                            ))
                        }
                    </div>
                )
            }
        </div>
    );
};