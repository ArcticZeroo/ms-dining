import React, { useCallback, useMemo, useState } from 'react';
import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { SearchEntityType } from '@msdining/common/models/search';
import { GroupMember } from './group-member.js';
import { classNames } from '../../../../util/react.js';
import { pluralizeWithCount } from '../../../../util/string.js';
import { GROUP_STORE } from '../../../../store/groups.js';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';

interface IGroupAddMembersWithDataProps {
    group: IGroupData;
    allItemsWithoutGroup: Map<SearchEntityType, Map<string, IGroupMember>>;
}

const cloneSelectedMembers = (selectedMemberIds: Map<SearchEntityType, Set<string>>): Map<SearchEntityType, Set<string>> => {
    return new Map(
        Array.from(selectedMemberIds.entries()).map(([type, ids]) => [type, new Set(ids)])
    );
};

const useVisibleItemsWithoutGroup = (selectedMembers: Map<SearchEntityType, Set<string>>, allItemsWithoutGroup: Map<SearchEntityType, Map<string, IGroupMember>>, substringQuery: string): IGroupMember[] => {
    return useMemo(() => {
        const lowerSubstringQuery = substringQuery.trim().toLowerCase();
        if (lowerSubstringQuery.length === 0) {
            return [];
        }

        const visibleItems: IGroupMember[] = [];

        for (const [type, membersById] of allItemsWithoutGroup.entries()) {
            for (const [memberId, member] of membersById.entries()) {
                const isSelected = selectedMembers.get(type)?.has(memberId) ?? false;
                if (isSelected) {
                    continue;
                }

                if (member.name.toLowerCase().includes(lowerSubstringQuery)) {
                    visibleItems.push(member);
                    continue;
                }

                if (member.metadata) {
                    for (const [key, value] of Object.entries(member.metadata)) {
                        if (key.toLowerCase().includes(lowerSubstringQuery) || value.toLowerCase().includes(lowerSubstringQuery)) {
                            visibleItems.push(member);
                            break;
                        }
                    }
                }
            }
        }

        return visibleItems;
    }, [allItemsWithoutGroup, selectedMembers, substringQuery]);
};

export const GroupAddMembersWithData: React.FC<IGroupAddMembersWithDataProps> = ({ group, allItemsWithoutGroup }) => {
    const [substringQuery, setSubstringQuery] = useState<string>('');
    const [selectedMembers, setSelectedMembers] = useState<Map<SearchEntityType, Set<string>>>(new Map());
    const selectedCount = Array.from(selectedMembers.values()).reduce((sum, memberIds) => sum + memberIds.size, 0);
    const allItemsCount = Array.from(allItemsWithoutGroup.values()).reduce((sum, membersById) => sum + membersById.size, 0);
    const visibleItemsWithoutGroup = useVisibleItemsWithoutGroup(selectedMembers, allItemsWithoutGroup, substringQuery);

    const { stage: addStage, run: addMembers } = useDelayedPromiseState(useCallback(async () => {
        const members: IGroupMember[] = [];

        for (const [type, memberIds] of selectedMembers.entries()) {
            const availableMembersOfType = allItemsWithoutGroup.get(type);
            if (!availableMembersOfType) {
                console.error('No available members of type', type, 'when adding to group');
                continue;
            }

            for (const memberId of memberIds) {
                if (availableMembersOfType.has(memberId)) {
                    members.push(availableMembersOfType.get(memberId)!);
                } else {
                    console.error('Member ID', memberId, 'of type', type, 'not found in available members when adding to group');
                }
            }
        }

        return GROUP_STORE.addGroupMembers(group.id, members);
    }, [allItemsWithoutGroup, group.id, selectedMembers]));

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

        const newSelectedMembers = cloneSelectedMembers(selectedMembers);
        const memberIdsForType = newSelectedMembers.get(member.type) || new Set<string>();

        if (memberIdsForType.has(member.id)) {
            memberIdsForType.delete(member.id);
            if (memberIdsForType.size === 0) {
                newSelectedMembers.delete(member.type);
            } else {
                newSelectedMembers.set(member.type, memberIdsForType);
            }
        } else {
            memberIdsForType.add(member.id);
            newSelectedMembers.set(member.type, memberIdsForType);
        }

        setSelectedMembers(newSelectedMembers);
    };

    return (
        <div className={classNames('flex-col', isSelectDisabled && 'disabled')}>
            <button className="default-button default-container" onClick={addMembers} disabled={isAddDisabled}>
                Add {pluralizeWithCount('member', selectedCount)} to Group
            </button>
            <div className="flex flex-center">
                <input
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
            <div className="flex member-toggle flex-wrap">
                {
                    selectedMembers.size > 0 &&
                    Array.from(selectedMembers).flatMap(([type, memberIds]) => {
                        const availableMembersOfType = allItemsWithoutGroup.get(type);
                        if (!availableMembersOfType) {
                            return [];
                        }

                        return Array.from(memberIds).map((memberId) => {
                            const member = availableMembersOfType.get(memberId);
                            if (!member) {
                                return null;
                            }

                            return (
                                <button
                                    key={`${type}-${memberId}`}
                                    className={classNames('card selected-button member active')}
                                    onClick={() => toggleSelection(member)}
                                >
                                    <GroupMember
                                        member={member}
                                    />
                                </button>
                            );
                        });
                    })
                }
                {
                    visibleItemsWithoutGroup.length > 0 && visibleItemsWithoutGroup.slice(0, 100).map((member) =>
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
        </div>
    );
};