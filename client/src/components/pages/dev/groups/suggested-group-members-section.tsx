import { IGroupMember } from '@msdining/common/models/group';
import React from 'react';
import { GroupMemberSection } from './group-member-section.js';

interface ISuggestedGroupMembersSectionProps {
    members: IGroupMember[];
    onToggleSelection: (member: IGroupMember) => void;
}

export const SuggestedGroupMembersSection: React.FC<ISuggestedGroupMembersSectionProps> = ({
    members,
    onToggleSelection,
}) => {
    return (
        <GroupMemberSection
            title="Suggested Members"
            members={members}
            buttonClassName="card default-button member"
            onToggleSelection={onToggleSelection}
        />
    );
};
