import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { useGroups } from '../../../../store/queries/groups.ts';
import { GroupListWithData } from './group-list-with-data.js';

export const GroupListBody = () => {
    const { data: groupList, error, refetch } = useGroups();

    if (groupList) {
        if (groupList.size === 0) {
            return (
                <span>
                    No groups currently exist.
                </span>
            );
        }

        return (
            <GroupListWithData groups={Array.from(groupList.values())}/>
        );
    }

    if (error) {
        return (
            <div className="flex-col">
                <span>
                    Failed to load groups
                </span>
                <RetryButton onClick={() => refetch()}/>
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