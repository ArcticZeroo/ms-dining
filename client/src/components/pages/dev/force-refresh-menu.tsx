import { classNames } from '../../../util/react.js';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.js';
import { useForceRefreshCafesMutation } from '../../../store/queries/cafe.js';

export const ForceRefreshMenu = () => {
    const refreshMutation = useForceRefreshCafesMutation();

    const onRefreshPressed = () => {
        if (refreshMutation.isPending) {
            return;
        }

        refreshMutation.mutate();
    };

    return (
        <>
            <button
                className={classNames(
                    'default-button default-container flex flex-center',
                    refreshMutation.isError && 'error',
                    refreshMutation.isSuccess && 'success',
                )}
                disabled={refreshMutation.isPending}
                onClick={onRefreshPressed}
            >
                <span className="material-symbols-outlined">
                        refresh
                </span>
                <span>
                        Force Refresh Cafes
                </span>
                {refreshMutation.isPending && <HourglassLoadingSpinner/>}
            </button>
            <div>
                {refreshMutation.error && String(refreshMutation.error)}
            </div>
        </>
    );
};