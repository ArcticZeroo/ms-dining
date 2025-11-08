import { useValueNotifier } from '../../../../hooks/events.js';
import { GROUP_STORE } from '../../../../store/groups.js';
import React, { useCallback, useMemo, useState } from 'react';
import { pluralize } from '../../../../util/string.js';
import { useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { SearchEntityType } from '@msdining/common/models/search';
import { IGroupMember } from '@msdining/common/models/group';
import { classNames } from '../../../../util/react.js';
import { canUseControllingButton, promiseStageToButtonClass } from '../../../../util/async.js';

const useGroupList = (selectedType: SearchEntityType) => {
    const { value: groupsById } = useValueNotifier(GROUP_STORE.groups);
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

    const { stage: commitStage, run: commitMembers } = useDelayedPromiseState(useCallback(
        async () => {
            const members = Array.from(selectedMembers.values());

            if (existingGroupId) {
                await GROUP_STORE.addGroupMembers(
                    existingGroupId,
                    members,
                );
            } else {
                await GROUP_STORE.createGroup(
                    groupName,
                    selectedType,
                    members,
                );
            }
            onClearSelection();
        },
        [existingGroupId, onClearSelection, selectedMembers, groupName, selectedType]
    ));

    const canCommit = canUseControllingButton(commitStage);
    const onCommitClicked = useCallback(() => {
        if (!canCommit) {
            return;
        }

        commitMembers();
    }, [canCommit, commitMembers]);

    const optionComponents = useMemo(() =>
        groupList.map(group => (
            <option
                key={group.id}
                value={group.id}
            >
                {group.name}{group.notes && ` (${group.notes})`} - {group.members.length} {pluralize('member', group.members.length)}
            </option>
        )), [groupList]);

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
            <div className="flex flex-center">
                <span>
                    Name this group:
                </span>
                <input
                    type="text"
                    placeholder="Group name"
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                />
            </div>
            <button
                className={classNames('default-button default-container', promiseStageToButtonClass(commitStage))}
                onClick={onCommitClicked}
            >
                {
                    existingGroupId ? 'Add to Group' : 'Create New Group'
                }
            </button>
            <button
                className="default-button default-container"
                onClick={onClearSelection}
            >
                Deselect Items (Cancel)
            </button>
        </div>
    );
};