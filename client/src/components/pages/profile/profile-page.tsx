import { Link } from 'react-router-dom';
import { usePageData } from '../../../hooks/location.ts';
import { useRequireLoginStatus } from '../../../hooks/auth.ts';
import { useOrderCountQuery } from '../../../store/queries/ordering.ts';
import { pluralize } from '../../../util/string.ts';
import { ProfileReviews } from './profile-reviews.tsx';
import { ProfileUserInfo } from './profile-user-info.tsx';
import './profile-page.css';

export const ProfilePage = () => {
    const isPageAllowed = useRequireLoginStatus(true);
    const orderCountQuery = useOrderCountQuery();

    usePageData('Profile', 'View and edit your profile information.');

    if (!isPageAllowed) {
        return null;
    }

    const orderHistoryText = orderCountQuery.data == null
        ? 'Order History'
        : `Order History (${orderCountQuery.data.count} ${pluralize('order', orderCountQuery.data.count)})`;

    return (
        <div className="flex flex-col">
            <ProfileUserInfo/>
            <ProfileReviews/>
            <Link to="/order/history" className="default-button default-container flex flex-center">
                <span className="material-symbols-outlined">
                    history
                </span>
                <span>
                    {orderHistoryText}
                </span>
            </Link>
            <a href="/api/auth/logout" className="default-button default-container flex flex-center error">
                <span className="material-symbols-outlined">
                    logout
                </span>
                <span>
                    Sign Out
                </span>
            </a>
        </div>
    );
}