import { useIsLoggedIn } from '../../hooks/auth.ts';
import { RecentOrderBannerBody } from './recent-order-banner-body.js';

export const RecentOrderBanner = () => {
    const isLoggedIn = useIsLoggedIn();

    if (!isLoggedIn) {
        return null;
    }

    return (
        <RecentOrderBannerBody/>
    );
};
