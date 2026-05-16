import { IGroupMember } from '@msdining/common/models/group';
import { GroupMember } from './group-member.js';
import React from 'react';
import { useDeleteGroupMember } from '../../../../../store/queries/groups.ts';
import { classNames } from '../../../../../util/react.js';
import { mutationButtonClass } from '../../../../../util/mutation.js';

interface IGroupListItemMemberProps {
    groupId: string;
    member: IGroupMember;
}

export const GroupListItemMember: React.FC<IGroupListItemMemberProps> = ({ groupId, member }) => {
    const deleteMutation = useDeleteGroupMember();

    const onDeleteClicked = () => {
        if (deleteMutation.isPending) {
            return;
        }
        deleteMutation.mutate({ groupId, memberId: member.id });
    };

    return (
        <div className="card">
            <GroupMember
                key={member.id}
                member={member}
            />
            <button
                className={classNames("material-symbols-outlined icon-container default-button default-container", mutationButtonClass(deleteMutation))}
                onClick={onDeleteClicked}
                disabled={deleteMutation.isPending}
                title={deleteMutation.error?.message}
            >
                delete
            </button>
        </div>
    );
}