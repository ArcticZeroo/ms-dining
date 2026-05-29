import { useIsLoggedIn } from '../../hooks/auth.ts';
import { RecentOrderBannerBody } from './recent-order-banner-body.js';
import { useLocation } from 'react-router-dom';

export const RecentOrderBanner = () => {
    const isLoggedIn = useIsLoggedIn();
    const location = useLocation();

    if (!isLoggedIn || location.pathname.startsWith('/order')) {
        return null;
    }

    return (
        <RecentOrderBannerBody/>
    );
};
