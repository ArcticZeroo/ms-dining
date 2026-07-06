import React from 'react';
import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { classNames } from '../../../../util/react.js';
import { pluralize } from '../../../../util/string.js';
import { AllItemsWithoutGroupByType } from '../../../../models/groups.js';
import { useGroupMemberSelection } from '../../../../hooks/group-member-selection.js';
import { SelectedGroupMembersSection } from './selected-group-members-section.js';
import { SuggestedGroupMembersSection } from './suggested-group-members-section.js';
import { SearchResultsGroupMembersSection } from './search-results-group-members-section.js';

interface IGroupAddMembersWithDataProps {
    group: IGroupData;
    allItemsWithoutGroup: AllItemsWithoutGroupByType;
    suggestedCandidates: IGroupMember[];
}

export const GroupAddMembersWithData: React.FC<IGroupAddMembersWithDataProps> = ({
    group,
    allItemsWithoutGroup,
    suggestedCandidates
}) => {
    const {
        substringQuery,
        selectedCount,
        allItemsCount,
        selectedMembers,
        visibleItemsWithoutGroup,
        visibleSuggestedCandidates,
        isAddDisabled,
        isSelectDisabled,
        onSubstringQueryChanged,
        onAddClicked,
        onToggleSelection,
    } = useGroupMemberSelection({
        group,
        allItemsWithoutGroup,
        suggestedCandidates,
    });

    if (allItemsWithoutGroup.size === 0) {
        return (
            <div>
                No items available to add to the group.
            </div>
        );
    }

    const scrollAnchorId = `search-members-${group.id}`;

    return (
        <div className={classNames('flex-col', isSelectDisabled && 'disabled')}>
            <button className="default-button default-container" onClick={onAddClicked} disabled={isAddDisabled}>
                Add {String(selectedCount)} {pluralize('member', selectedCount)} to Group
            </button>
            <div className="flex flex-center">
                <input
                    id={scrollAnchorId}
                    type="text"
                    placeholder="Search members..."
                    value={substringQuery}
                    onChange={(event) => onSubstringQueryChanged(event.target.value)}
                    disabled={isSelectDisabled}
                />
                <span>
                    {visibleItemsWithoutGroup.length} matching query / {allItemsCount} available
                </span>
            </div>
            <div className="flex-col member-toggle">
                <SelectedGroupMembersSection
                    members={selectedMembers}
                    onToggleSelection={onToggleSelection}
                />
                <SuggestedGroupMembersSection
                    members={visibleSuggestedCandidates}
                    onToggleSelection={onToggleSelection}
                />
                <SearchResultsGroupMembersSection
                    members={visibleItemsWithoutGroup}
                    scrollAnchorId={scrollAnchorId}
                    onToggleSelection={onToggleSelection}
                />
            </div>
        </div>
    );
};