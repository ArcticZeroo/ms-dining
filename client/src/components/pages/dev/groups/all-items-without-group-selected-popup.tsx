import { useAddGroupMembers, useCreateGroup, useGroups } from '../../../../store/queries/groups.ts';
import React, { useCallback, useMemo, useState } from 'react';
import { pluralize } from '../../../../util/string.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { IGroupMember } from '@msdining/common/models/group';
import { classNames } from '../../../../util/react.js';
import { canUseMutationButton, mutationButtonClass } from '../../../../util/mutation.js';

const useGroupList = (selectedType: SearchEntityType) => {
    const { data: groupsById } = useGroups();
    return useMemo(
        () => {
            const groupList = groupsById ? Array.from(groupsById.values()) : [];
            return groupList.filter(group => group.type === selectedType).sort((a, b) => a.name.localeCompare(b.name));
        },
        [groupsById, selectedType]
    );
};

interface IAllItemsWithoutGroupSelectedPopupProps {
    selectedMembers: Map<string, IGroupMember>;
    selectedType: SearchEntityType;
    onClearSelection: () => void;
}

export const AllItemsWithoutGroupSelectedPopup: React.FC<IAllItemsWithoutGroupSelectedPopupProps> = ({
    selectedMembers,
    onClearSelection,
    selectedType
}) => {
    const groupList = useGroupList(selectedType);
    const [groupName, setGroupName] = useState<string>('');
    const [existingGroupId, setExistingGroupId] = useState<string | null>(null);

    const addMutation = useAddGroupMembers();
    const createMutation = useCreateGroup();

    const isCommittingExisting = existingGroupId != null;
    const activeMutation = isCommittingExisting ? addMutation : createMutation;
    const canCommit = canUseMutationButton(activeMutation);
    const commitButtonClass = mutationButtonClass(activeMutation);

    const onCommitClicked = useCallback(() => {
        if (!canCommit) {
            return;
        }

        const members = Array.from(selectedMembers.values());

        if (existingGroupId) {
            addMutation.mutate(
                { groupId: existingGroupId, members },
                { onSuccess: onClearSelection },
            );
        } else {
            createMutation.mutate(
                { name: groupName, type: selectedType, initialMembers: members },
                { onSuccess: onClearSelection },
            );
        }
    }, [canCommit, selectedMembers, existingGroupId, addMutation, onClearSelection, createMutation, groupName, selectedType]);

    const optionComponents = useMemo(() =>
        groupList.map(group => (
            <option
                key={group.id}
                value={group.id}
            >
                {group.name}{group.notes && ` (${group.notes})`} - {group.members.length} {pluralize('member', group.members.length)}
            </option>
        )), [groupList]);

    const onClearSelectionClicked = useCallback(() => {
        if (!canCommit) {
            return;
        }

        onClearSelection();
    }, [canCommit, onClearSelection]);

    const onGroupNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (!canCommit || existingGroupId) {
            return;
        }

        setGroupName(event.target.value);
    }, [canCommit, existingGroupId]);

    return (
        <div className="flex-col card" id="floating-create-group">
            <div className="title">
                Selected {selectedMembers.size} {pluralize('Item', selectedMembers.size)}
            </div>
            {
                groupList.length > 0 && (
                    <div className="flex flex-center">
                        <span>
                                Choose an existing group:
                        </span>
                        <select
                            onChange={(event) => {
                                const value = event.target.value;
                                setExistingGroupId(value === '' ? null : value);
                            }}
                            value={existingGroupId ?? ''}
                        >
                            <option value="">
                                -- Create New Group --
                            </option>
                            {optionComponents}
                        </select>
                    </div>
                )
            }
            <div className={classNames("flex flex-center", existingGroupId && 'greyed-out-not-allowed')}>
                <span>
                    Name this group:
                </span>
                <input
                    type="text"
                    placeholder="Group name"
                    value={groupName}
                    onChange={onGroupNameChange}
                    disabled={existingGroupId != null}
                />
            </div>
            <button
                className={classNames('default-button default-container', commitButtonClass)}
                onClick={onCommitClicked}
                disabled={!canCommit}
            >
                {
                    existingGroupId ? 'Add to Group' : 'Create New Group'
                }
            </button>
            <button
                className="default-button default-container"
                onClick={onClearSelectionClicked}
                disabled={!canCommit}
            >
                Deselect Items (Cancel)
            </button>
        </div>
    );
};