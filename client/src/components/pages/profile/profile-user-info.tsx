import { AuthProviderBadge } from '../../auth/auth-provider-badge.tsx';
import { DisplayNameControl } from './display-name-control.tsx';
import { UserContext } from '../../../context/auth.js';
import { useValueNotifierContext } from '../../../hooks/events.js';

export const ProfileUserInfo = () => {
    const user = useValueNotifierContext(UserContext);

    if (!user) {
        return (
            <div className="error card">
                Your user info isn't available. Please log out and log back in.
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-center">
                <div className="provider-chip flex flex-center default-container">
                    <span>
                        Logged in via
                    </span>
                    <AuthProviderBadge provider={user.provider}/>
                </div>
            </div>
            <div className="card">
                <div className="title">
                    Display Name
                </div>
                <div className="subtitle">
                    Visible in reviews.
                </div>
                <DisplayNameControl user={user}/>
            </div>
        </>
    );
}