import { HomeCollapse } from '../home-collapse.tsx';
import { HomeSettings } from '../../../../constants/settings.ts';
import { LogInForReviewButton } from '../../../reviews/log-in-for-review-button.tsx';
import { HomeRecentReviewsView } from './home-recent-reviews-view.tsx';

export const HomeRecentReviews = () => {
    return (
        <HomeCollapse title="Recent Reviews" featureToggle={HomeSettings.showRecentReviewsOnHome}>
            <div className="flex-col">
                <LogInForReviewButton/>
                <HomeRecentReviewsView/>
            </div>
        </HomeCollapse>
    );
}