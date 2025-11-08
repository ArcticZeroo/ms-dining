import React, { useCallback, useMemo, useState } from 'react';
import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { SearchEntityType } from '@msdining/common/models/search';
import { GroupMember } from './group-member/group-member.js';
import { classNames } from '../../../../util/react.js';
import { pluralize } from '../../../../util/string.js';
import { GROUP_STORE } from '../../../../store/groups.js';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { AllItemsWithoutGroupByType } from '../../../../models/groups.js';

interface IGroupAddMembersWithDataProps {
    group: IGroupData;
    allItemsWithoutGroup: AllItemsWithoutGroupByType;
    suggestedCandidates: IGroupMember[];
}

interface IUseVisibleItemsWithoutGroupParams {
    groupType: SearchEntityType;
    selectedMemberIds: Set<string>;
    allItemsWithoutGroup: AllItemsWithoutGroupByType;
    substringQuery: string;
    suggestedCandidateIds: Set<string>;
}

const useVisibleItemsWithoutGroup = ({
    groupType,
    selectedMemberIds,
    allItemsWithoutGroup,
    substringQuery,
    suggestedCandidateIds
}: IUseVisibleItemsWithoutGroupParams): IGroupMember[] => {
    return useMemo(() => {
        const lowerSubstringQuery = substringQuery.trim().toLowerCase();
        if (lowerSubstringQuery.length === 0) {
            return [];
        }

        const allItemsForGroupType = allItemsWithoutGroup.get(groupType);
        if (!allItemsForGroupType) {
            return [];
        }

        const visibleItems: IGroupMember[] = [];

        for (const [memberId, member] of allItemsForGroupType) {
            const isSelected = selectedMemberIds.has(memberId) ?? false;
            if (isSelected) {
                continue;
            }

            if (suggestedCandidateIds.has(memberId)) {
                continue;
            }

            if (member.name.toLowerCase().includes(lowerSubstringQuery)) {
                visibleItems.push(member);
                continue;
            }
        }

        return visibleItems;
    }, [allItemsWithoutGroup, groupType, selectedMemberIds, substringQuery, suggestedCandidateIds]);
};

const useVisibleSuggestedCandidates = (suggestedCandidates: IGroupMember[], selectedMemberIds: Set<string>): IGroupMember[] => {
    return useMemo(
        () => suggestedCandidates.filter(candidate => !selectedMemberIds.has(candidate.id)),
        [selectedMemberIds, suggestedCandidates]
    );
}

export const GroupAddMembersWithData: React.FC<IGroupAddMembersWithDataProps> = ({
    group,
    allItemsWithoutGroup,
    suggestedCandidates
}) => {
    const [substringQuery, setSubstringQuery] = useState<string>('');
    const suggestedCandidateIds = useMemo(
        () => new Set(suggestedCandidates.map(candidate => candidate.id)),
        [suggestedCandidates]
    );
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => new Set(suggestedCandidateIds));

    const selectedCount = selectedMemberIds.size;
    const availableItemsOfType = allItemsWithoutGroup.get(group.type);
    const allItemsCount = availableItemsOfType?.size ?? 0;

    const visibleItemsWithoutGroup = useVisibleItemsWithoutGroup({
        groupType: group.type,
        selectedMemberIds,
        allItemsWithoutGroup,
        substringQuery,
        suggestedCandidateIds,
    });

    const visibleSuggestedCandidates = useVisibleSuggestedCandidates(suggestedCandidates, selectedMemberIds);

    const selectedMembers = useMemo(
        () => {
            if (!availableItemsOfType) {
                return [];
            }

            const members: IGroupMember[] = [];
            for (const memberId of selectedMemberIds) {
                const member = availableItemsOfType.get(memberId);
                if (member) {
                    members.push(member);
                } else {
                    console.error(`Selected member ID ${memberId} of type ${group.type} not found in available members`);
                }
            }
            return members;
        },
        [availableItemsOfType, group.type, selectedMemberIds]
    );

    const { stage: addStage, run: addMembers } = useDelayedPromiseState(useCallback(async () => {
        await GROUP_STORE.addGroupMembers(group.id, selectedMembers);
        setSelectedMemberIds(new Set());
    }, [group.id, selectedMembers]));

    if (allItemsWithoutGroup.size === 0) {
        return (
            <div>
                No items available to add to the group.
            </div>
        );
    }

    const isAddDisabled = addStage === PromiseStage.running || selectedCount === 0;
    const isSelectDisabled = addStage === PromiseStage.running;

    const toggleSelection = (member: IGroupMember) => {
        if (isSelectDisabled) {
            return;
        }

        const newSelectedMembers = new Set(selectedMemberIds);
        if (newSelectedMembers.has(member.id)) {
            newSelectedMembers.delete(member.id);
        } else {
            newSelectedMembers.add(member.id);
        }

        setSelectedMemberIds(newSelectedMembers);
    };

    const scrollAnchorId = `search-members-${group.id}`;

    return (
        <div className={classNames('flex-col', isSelectDisabled && 'disabled')}>
            <button className="default-button default-container" onClick={addMembers} disabled={isAddDisabled}>
                Add {String(selectedCount)} {pluralize('member', selectedCount)} to Group
            </button>
            <div className="flex flex-center">
                <input
                    id={scrollAnchorId}
                    type="text"
                    placeholder="Search members..."
                    value={substringQuery}
                    onChange={(event) => setSubstringQuery(event.target.value)}
                    disabled={isSelectDisabled}
                />
                <span>
                    {visibleItemsWithoutGroup.length} matching query / {allItemsCount} available
                </span>
            </div>
            <div className="flex-col member-toggle">
                {
                    selectedMembers.length > 0 && (
                        <>
                            <span>
                                Selected Members
                            </span>
                            <div className="flex flex-wrap">
                                {
                                    Array.from(selectedMembers).map((member) => {
                                        return (
                                            <button
                                                key={`${member.type}-${member.id}`}
                                                className={classNames('card selected-button member active')}
                                                onClick={() => toggleSelection(member)}
                                            >
                                                <GroupMember
                                                    member={member}
                                                />
                                            </button>
                                        );
                                    })
                                }
                            </div>
                        </>
                    )
                }
                {
                    visibleSuggestedCandidates.length > 0 && (
                        <>
                            <span>
                                Suggested Members
                            </span>
                            <div className="flex flex-wrap">
                                {
                                    visibleSuggestedCandidates.map((member) => (
                                        <button
                                            key={`${member.type}-${member.id}`}
                                            className={classNames('card default-button member')}
                                            onClick={() => toggleSelection(member)}
                                        >
                                            <GroupMember
                                                key={`${member.type}-${member.id}`}
                                                member={member}
                                            />
                                        </button>
                                    ))
                                }
                            </div>
                        </>
                    )
                }
                {
                    visibleItemsWithoutGroup.length > 0 && (
                        <>
                            <span>
                                Search Results
                            </span>
                            <div className="flex flex-wrap">
                                {
                                    visibleItemsWithoutGroup.slice(0, 100).map((member) =>
                                        (
                                            <button
                                                key={`${member.type}-${member.id}`}
                                                className={classNames('card default-button member')}
                                                onClick={() => toggleSelection(member)}
                                            >
                                                <GroupMember
                                                    key={`${member.type}-${member.id}`}
                                                    member={member}
                                                />
                                            </button>
                                        ))
                                }
                            </div>
                            {
                                visibleItemsWithoutGroup.length > 100 && (
                                    <div className="flex-col">
                                        <span>
                                            Showing first 100 of {visibleItemsWithoutGroup.length} results. Please refine your search to see more.
                                        </span>
                                        <a href={`#${scrollAnchorId}`} className="default-container default-button">
                                            Jump to Search Box
                                        </a>
                                    </div>
                                )
                            }
                        </>
                    )
                }
            </div>
        </div>
    );
};