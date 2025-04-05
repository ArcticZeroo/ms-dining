import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { RetryButton } from '../../button/retry-button.tsx';
import { AuthProviderBadge } from '../../auth/auth-provider-badge.tsx';
import { DisplayNameControl } from './display-name-control.tsx';
import { usePageData } from '../../../hooks/location.ts';

import './profile-page.css';
import { useRequireLoginStatus } from '../../../hooks/auth.ts';
import { useEffect } from 'react';

export const ProfilePage = () => {
    const { value: user, run: fetchUser, stage } = useDelayedPromiseState(DiningClient.retrieveAuthenticatedUser);
    const isPageAllowed = useRequireLoginStatus(true);

    usePageData('Profile', 'View and edit your profile information.');

    useEffect(() => {
        if (isPageAllowed) {
            fetchUser();
        }
    }, [isPageAllowed, fetchUser]);

    if (!isPageAllowed) {
        return null;
    }

    if ([PromiseStage.notRun, PromiseStage.running].includes(stage)) {
        return (
            <div className="card">
                <HourglassLoadingSpinner/>
                <span>
                    Loading your profile...
                </span>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="card">
                <span>
                    Failed to load your profile!
                </span>
                <RetryButton onClick={fetchUser}/>
            </div>
        )
    }

    return (
        <div className="flex-col">
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