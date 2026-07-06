import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { SearchEntityType } from '@msdining/common/models/search';
import { useCallback, useMemo, useState } from 'react';
import { AllItemsWithoutGroupByType } from '../models/groups.js';
import { useAddGroupMembers } from '../store/queries/groups.ts';

interface IUseVisibleItemsWithoutGroupParams {
    groupType: SearchEntityType;
    selectedMemberIds: Set<string>;
    allItemsWithoutGroup: AllItemsWithoutGroupByType;
    substringQuery: string;
    suggestedCandidateIds: Set<string>;
}

interface IUseGroupMemberSelectionParams {
    group: IGroupData;
    allItemsWithoutGroup: AllItemsWithoutGroupByType;
    suggestedCandidates: IGroupMember[];
}

export interface IGroupMemberSelection {
    substringQuery: string;
    selectedCount: number;
    allItemsCount: number;
    selectedMembers: IGroupMember[];
    visibleItemsWithoutGroup: IGroupMember[];
    visibleSuggestedCandidates: IGroupMember[];
    isAddDisabled: boolean;
    isSelectDisabled: boolean;
    onSubstringQueryChanged: (substringQuery: string) => void;
    onAddClicked: () => void;
    onToggleSelection: (member: IGroupMember) => void;
}

const useVisibleItemsWithoutGroup = ({
    groupType,
    selectedMemberIds,
    allItemsWithoutGroup,
    substringQuery,
    suggestedCandidateIds,
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
};

export const useGroupMemberSelection = ({
    group,
    allItemsWithoutGroup,
    suggestedCandidates,
}: IUseGroupMemberSelectionParams): IGroupMemberSelection => {
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

    const addMutation = useAddGroupMembers();

    const onAddClicked = useCallback(() => {
        addMutation.mutate(
            { groupId: group.id, members: selectedMembers },
            { onSuccess: () => setSelectedMemberIds(new Set()) },
        );
    }, [addMutation, group.id, selectedMembers]);

    const isAddDisabled = addMutation.isPending || selectedCount === 0;
    const isSelectDisabled = addMutation.isPending;

    const onToggleSelection = useCallback((member: IGroupMember) => {
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
    }, [isSelectDisabled, selectedMemberIds]);

    return {
        substringQuery,
        selectedCount,
        allItemsCount,
        selectedMembers,
        visibleItemsWithoutGroup,
        visibleSuggestedCandidates,
        isAddDisabled,
        isSelectDisabled,
        onSubstringQueryChanged: setSubstringQuery,
        onAddClicked,
        onToggleSelection,
    };
};
