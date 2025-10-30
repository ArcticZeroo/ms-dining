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

const useVisibleItemsWithoutGroup = (groupType: SearchEntityType, selectedMembers: Set<string>, allItemsWithoutGroup: Map<SearchEntityType, Map<string, IGroupMember>>, substringQuery: string): IGroupMember[] => {
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
            const isSelected = selectedMembers.has(memberId) ?? false;
            if (isSelected) {
                continue;
            }

            if (member.name.toLowerCase().includes(lowerSubstringQuery)) {
                visibleItems.push(member);
                // continue;
            }
            //
            // if (member.metadata) {
            //     for (const [key, value] of Object.entries(member.metadata)) {
            //         if (key.toLowerCase().includes(lowerSubstringQuery) || value.toLowerCase().includes(lowerSubstringQuery)) {
            //             visibleItems.push(member);
            //             break;
            //         }
            //     }
            // }
        }

        return visibleItems;
    }, [allItemsWithoutGroup, groupType, selectedMembers, substringQuery]);
};

export const GroupAddMembersWithData: React.FC<IGroupAddMembersWithDataProps> = ({ group, allItemsWithoutGroup }) => {
    const [substringQuery, setSubstringQuery] = useState<string>('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const selectedCount = selectedMemberIds.size;
    const availableItemsOfType = allItemsWithoutGroup.get(group.type);
    const allItemsCount = availableItemsOfType?.size ?? 0;
    const visibleItemsWithoutGroup = useVisibleItemsWithoutGroup(group.type, selectedMemberIds, allItemsWithoutGroup, substringQuery);
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
        return GROUP_STORE.addGroupMembers(group.id, selectedMembers);
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
                    selectedMemberIds.size > 0 &&
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