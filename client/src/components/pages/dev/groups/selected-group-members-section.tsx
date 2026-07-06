import { IGroupMember } from '@msdining/common/models/group';
import React from 'react';
import { GroupMemberSection } from './group-member-section.js';

interface ISelectedGroupMembersSectionProps {
    members: IGroupMember[];
    onToggleSelection: (member: IGroupMember) => void;
}

export const SelectedGroupMembersSection: React.FC<ISelectedGroupMembersSectionProps> = ({
    members,
    onToggleSelection,
}) => {
    return (
        <GroupMemberSection
            title="Selected Members"
            members={members}
            buttonClassName="card selected-button member active"
            onToggleSelection={onToggleSelection}
        />
    );
};
