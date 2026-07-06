import { IGroupMember } from '@msdining/common/models/group';
import React from 'react';
import { GroupMemberToggleButton } from './group-member-toggle-button.js';

interface IGroupMemberSectionProps {
    title: string;
    members: IGroupMember[];
    buttonClassName: string;
    onToggleSelection: (member: IGroupMember) => void;
}

export const GroupMemberSection: React.FC<IGroupMemberSectionProps> = ({
    title,
    members,
    buttonClassName,
    onToggleSelection,
}) => {
    if (members.length === 0) {
        return null;
    }

    return (
        <>
            <span>
                {title}
            </span>
            <div className="flex flex-wrap">
                {
                    members.map((member) => (
                        <GroupMemberToggleButton
                            key={`${member.type}-${member.id}`}
                            member={member}
                            className={buttonClassName}
                            onClick={onToggleSelection}
                        />
                    ))
                }
            </div>
        </>
    );
};
