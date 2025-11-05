import { Group } from './group.js';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { useValueNotifier } from '../../../../hooks/events.js';
import { GROUP_STORE } from '../../../../store/groups.js';

export const GroupListBody = () => {
    const { value: groupList, error, run: runRetrieveGroupList } = useValueNotifier(GROUP_STORE.groups);

    if (groupList) {
        if (groupList.size === 0) {
            return (
                <span>
                    No groups currently exist.
                </span>
            );
        }

        return (
            <div className="flex-col group-list-vertical-scroll">
                {
                    Array.from(groupList.values()).map((group) => (
                        <Group key={group.id} group={group}/>
                    ))
                }
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-col">
                <span>
                    Failed to load groups
                </span>
                <RetryButton onClick={runRetrieveGroupList}/>
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