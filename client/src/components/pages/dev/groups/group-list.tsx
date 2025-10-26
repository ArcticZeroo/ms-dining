import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { retrieveGroupList } from '../../../../api/client/groups.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { RetryButton } from '../../../button/retry-button.js';

export const GroupList = () => {
    const { value: groupList, error, run: retry } = useImmediatePromiseState(retrieveGroupList);

    if (groupList) {
        if (groupList.length === 0) {
            return (
                <span>
                    No groups currently exist.
                </span>
            );
        }

        return (
            <div className="flex-col">
                {groupList.map((group) => (
                    <div key={group.id} className="card default-container">
                        <span>
                            {group.name}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-col">
                <span>
                    Failed to load groups
                </span>
                <RetryButton onClick={retry}/>
            </div>
        );
    }

    return (
        <div className="flex">
            <HourglassLoadingSpinner/>
            <span>Loading groups...</span>
        </div>
    );
}