import './groups.css';
import { useItemsWithoutGroup } from '../../../../store/queries/groups.ts';
import { AllItemsWithoutGroupWithData } from './all-items-without-group-with-data.js';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';

export const AllItemsWithoutGroup = () => {
    const { data: allItemsWithoutGroup, error, refetch } = useItemsWithoutGroup();

    if (allItemsWithoutGroup) {
        return (
            <AllItemsWithoutGroupWithData
                allItemsWithoutGroup={allItemsWithoutGroup}
            />
        );
    }

    if (error) {
        return (
            <div className="flex-col">
                <span>
                    Failed to load list of items without a group.
                </span>
                <RetryButton onClick={() => refetch()}/>
            </div>
        );
    }

    return (
        <div className="flex-col">
            <span>
                Loading list of items without a group...
            </span>
            <HourglassLoadingSpinner/>
        </div>
    );
}