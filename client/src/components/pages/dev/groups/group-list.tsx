import { useValueNotifier } from '../../../../hooks/events.ts';
import { GROUP_STORE } from '../../../../store/groups.ts';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GroupListItem } from './group-list-item.js';

export const GroupList = () => {
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
            <div className="flex-col">
                {
                    Array.from(groupList.values()).map((group) => (
                        <GroupListItem key={group.id} group={group}/>
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