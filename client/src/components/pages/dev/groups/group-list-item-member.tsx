import { IGroupMember } from '@msdining/common/models/group';
import { GroupMember } from './group-member.js';
import React, { useCallback } from 'react';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { GROUP_STORE } from '../../../../store/groups.js';

interface IGroupListItemMemberProps {
    groupId: string;
    member: IGroupMember;
}

export const GroupListItemMember: React.FC<IGroupListItemMemberProps> = ({ groupId, member }) => {
    const { actualStage: deleteStage, run: deleteGroupMember } = useDelayedPromiseState(useCallback(
        () => GROUP_STORE.deleteGroupMember(groupId, member.id),
        [groupId, member.id]
    ));

    const canDelete = deleteStage !== PromiseStage.running;

    const onDeleteClicked = () => {
        if (canDelete) {
            deleteGroupMember();
        }
    }

    return (
        <div className="card">
            <GroupMember
                key={member.id}
                member={member}
            />
            <button
                className="material-symbols-outlined icon-container default-button default-container"
                onClick={onDeleteClicked}
            >
                delete
            </button>
        </div>
    );
}