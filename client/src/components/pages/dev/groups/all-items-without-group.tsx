import './groups.css';
import { GROUP_STORE } from '../../../../store/groups.js';
import { useValueNotifier } from '../../../../hooks/events.js';
import { AllItemsWithoutGroupWithData } from './all-items-without-group-with-data.js';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';

export const AllItemsWithoutGroup = () => {
    const { stage: allItemsWithoutGroupStage, value: allItemsWithoutGroup, run: retryGetAllItemsWithoutGroup } = useValueNotifier(GROUP_STORE.allItemsWithoutGroup);

    if (allItemsWithoutGroup) {
        return (
            <AllItemsWithoutGroupWithData
                allItemsWithoutGroup={allItemsWithoutGroup}
            />
        );
    }

    if (allItemsWithoutGroupStage === PromiseStage.error) {
        return (
            <div className="flex-col">
                <span>
                    Failed to load list of items without a group.
                </span>
                <RetryButton onClick={retryGetAllItemsWithoutGroup}/>
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