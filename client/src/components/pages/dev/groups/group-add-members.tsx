import React from 'react';
import { IGroupData } from '@msdining/common/models/group';
import { useValueNotifier } from '../../../../hooks/events.js';
import { GROUP_STORE } from '../../../../store/groups.js';
import { RetryButton } from '../../../button/retry-button.js';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GroupAddMembersWithData } from './group-add-members-with-data.js';

interface IGroupAddMembersProps {
    group: IGroupData;
}

export const GroupAddMembers: React.FC<IGroupAddMembersProps> = ({ group }) => {
    const { stage, value: allItemsWithoutGroup, run: retry } = useValueNotifier(GROUP_STORE.allItemsWithoutGroup);

    if (allItemsWithoutGroup) {
        return (
            <GroupAddMembersWithData allItemsWithoutGroup={allItemsWithoutGroup} group={group}/>
        );
    }

    if (stage === PromiseStage.error) {
        return (
            <div>
                <span>
                    Failed to load items.
                </span>
                <RetryButton onClick={retry}/>
            </div>
        )
    }

    return (
        <div className="flex flex-center">
            <span>
                Loading items...
            </span>
            <HourglassLoadingSpinner/>
        </div>
    );
};