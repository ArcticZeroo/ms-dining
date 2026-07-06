import { IGroupMember } from '@msdining/common/models/group';
import React, { useMemo } from 'react';
import { GroupMemberSection } from './group-member-section.js';

interface ISearchResultsGroupMembersSectionProps {
    members: IGroupMember[];
    scrollAnchorId: string;
    onToggleSelection: (member: IGroupMember) => void;
}

export const SearchResultsGroupMembersSection: React.FC<ISearchResultsGroupMembersSectionProps> = ({
    members,
    scrollAnchorId,
    onToggleSelection,
}) => {
    const visibleMembers = useMemo(
        () => members.slice(0, 100),
        [members]
    );

    if (members.length === 0) {
        return null;
    }

    return (
        <>
            <GroupMemberSection
                title="Search Results"
                members={visibleMembers}
                buttonClassName="card default-button member"
                onToggleSelection={onToggleSelection}
            />
            {
                members.length > 100 && (
                    <div className="flex-col">
                        <span>
                            Showing first 100 of {members.length} results. Please refine your search to see more.
                        </span>
                        <a href={`#${scrollAnchorId}`} className="default-container default-button">
                            Jump to Search Box
                        </a>
                    </div>
                )
            }
        </>
    );
};
