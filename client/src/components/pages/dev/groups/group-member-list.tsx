import { IGroupData } from '@msdining/common/models/group';
import React from 'react';
import { GroupListItemMember } from './group-member/group-list-item-member.js';

interface IGroupMemberListProps {
    group: IGroupData;
}

export const GroupMemberList: React.FC<IGroupMemberListProps> = ({ group }) => {
    return (
        <div className="flex flex-wrap">
            {
                group.members.map((member) => (
                    <GroupListItemMember
                        key={`${member.type}-${member.id}`}
                        groupId={group.id}
                        member={member}
                    />
                ))
            }
        </div>
    );
};
