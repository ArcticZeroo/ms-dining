import { usePageData } from '../../../hooks/location.ts';
import { useRequireLoginStatus } from '../../../hooks/auth.ts';
import { ProfileReviews } from './profile-reviews.tsx';
import { ProfileUserInfo } from './profile-user-info.tsx';
import './profile-page.css';

export const ProfilePage = () => {
    const isPageAllowed = useRequireLoginStatus(true);

    usePageData('Profile', 'View and edit your profile information.');

    if (!isPageAllowed) {
        return null;
    }

    return (
        <div className="flex flex-col">
            <ProfileUserInfo/>
            <ProfileReviews/>
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