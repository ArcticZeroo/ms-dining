import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.js';
import { useRequireRole } from '../../../hooks/auth.js';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.js';
import { classNames } from '../../../util/react.js';

export const DevPage = () => {
    useRequireRole('admin');

    const refreshState = useDelayedPromiseState(DiningClient.forceRefreshCafes);

    const onRefreshPressed = () => {
        if (refreshState.actualStage === PromiseStage.running) {
            return;
        }

        refreshState.run();
    };

    return (
        <div className="card" id="dev-page">
            <div className="title">
                Dev Settings
            </div>
            <div className="flex">
                <button
                    className={classNames('default-button default-container flex flex-center', refreshState.stage === PromiseStage.error && 'error', refreshState.stage === PromiseStage.success && 'success')}
                    disabled={refreshState.actualStage === PromiseStage.running}
                    onClick={onRefreshPressed}
                >
                    <span className="material-symbols-outlined">
                        refresh
                    </span>
                    <span>
                        Force Refresh Cafes
                    </span>
                    {
                        refreshState.actualStage === PromiseStage.running && (
                            <HourglassLoadingSpinner/>
                        )
                    }
                </button>
                <div>
                    {
                        refreshState.error && String(refreshState.error)
                    }
                </div>
            </div>
        </div>
    );
};