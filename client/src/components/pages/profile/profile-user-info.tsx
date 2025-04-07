import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { RetryButton } from '../../button/retry-button.tsx';
import { AuthProviderBadge } from '../../auth/auth-provider-badge.tsx';
import { DisplayNameControl } from './display-name-control.tsx';
import { DiningClient } from '../../../api/dining.ts';

export const ProfileUserInfo = () => {
    const { value: user, run: fetchUser, stage } = useImmediatePromiseState(DiningClient.retrieveAuthenticatedUser);

    if ([PromiseStage.notRun, PromiseStage.running].includes(stage)) {
        return (
            <div className="card">
                <span>
                    Loading your profile...
                </span>
                <HourglassLoadingSpinner/>
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