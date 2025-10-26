import { classNames } from '../../../util/react.js';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.js';
import { DiningClient } from '../../../api/dining.js';

export const ForceRefreshMenu = () => {
    const refreshState = useDelayedPromiseState(DiningClient.forceRefreshCafes);

    const onRefreshPressed = () => {
        if (refreshState.actualStage === PromiseStage.running) {
            return;
        }

        refreshState.run();
    };

    return (
        <>
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
        </>
    );
};