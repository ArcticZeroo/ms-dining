import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { AuthProviderBadge } from '../../auth/auth-provider-badge.tsx';
import { AuthenticatedFailureCard } from '../../card/authenticated-failure-card.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { DisplayNameControl } from './display-name-control.tsx';

export const ProfileUserInfo = () => {
    const { value: user, run: fetchUser, stage, error } = useImmediatePromiseState(DiningClient.retrieveAuthenticatedUser);

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
            <AuthenticatedFailureCard
                message="Failed to load your profile!"
                error={error}
                onRetry={fetchUser}
            />
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