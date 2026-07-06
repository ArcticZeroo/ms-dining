import { IGroupMember } from '@msdining/common/models/group';
import React from 'react';
import { GroupMember } from './group-member/group-member.js';

interface IGroupMemberToggleButtonProps {
    member: IGroupMember;
    className: string;
    onClick: (member: IGroupMember) => void;
}

export const GroupMemberToggleButton: React.FC<IGroupMemberToggleButtonProps> = ({
    member,
    className,
    onClick,
}) => {
    return (
        <button
            className={className}
            onClick={() => onClick(member)}
        >
            <GroupMember
                key={`${member.type}-${member.id}`}
                member={member}
            />
        </button>
    );
};
