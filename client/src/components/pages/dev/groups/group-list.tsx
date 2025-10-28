import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { retrieveGroupList } from '../../../../api/client/groups.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { RetryButton } from '../../../button/retry-button.js';
import { GroupListItem } from './group-list-item.js';
import { useContext, useEffect, useState } from 'react';
import { GroupEventsContext } from '../../../../context/groups.js';
import { IGroupData } from '@msdining/common/models/group';

const useGroupList = () => {
    const groupEvents = useContext(GroupEventsContext);
    const { stage, value: groupListResponse, error, run: runRetrieveGroupList } = useImmediatePromiseState(retrieveGroupList);
    const [localGroupList, setLocalGroupList] = useState<Array<IGroupData>>([]);

    useEffect(() => {
        setLocalGroupList(groupListResponse ?? []);
    }, [groupListResponse]);

    groupEvents.on('updateGroupList', () => {
        runRetrieveGroupList();
    });

    groupEvents.on('groupCreated', (group: IGroupData) => {
        setLocalGroupList([...localGroupList, group]);
    });

    groupEvents.on('groupDeleted', (groupId: string) => {
        setLocalGroupList(localGroupList.filter(group => group.id !== groupId));
    });

    return { stage: stage, groupList: localGroupList, error, runRetrieveGroupList };
}

export const GroupList = () => {
    const { stage: groupListLoadingStage, groupList, error, runRetrieveGroupList } = useGroupList();

    // const { stage, value: groupListResponse, error, run: runRetrieveGroupList } = useImmediatePromiseState(retrieveItemsWithoutGroup);

    if (groupListLoadingStage === PromiseStage.success) {
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
                    <GroupListItem key={group.id} group={group}/>
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