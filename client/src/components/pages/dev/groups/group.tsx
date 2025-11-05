import { useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { IGroupData } from '@msdining/common/models/group';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import React, { useCallback, useState } from 'react';
import { GROUP_STORE } from '../../../../store/groups.ts';
import { canUseControllingButton, promiseStageToButtonClass } from '../../../../util/async.js';
import { classNames } from '../../../../util/react.js';
import { GroupAddMembers } from './group-add-members.js';
import { GroupListItemMember } from './group-member/group-list-item-member.js';
import { GroupTypeIcon } from './group-type-icon.js';

interface IGroupProps {
    group: IGroupData;
}

const useAccordionButtonHandler = (handler?: (event: React.MouseEvent) => void) => {
    return useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handler?.(event);
    }, [handler]);
};

const useEditControls = (group: IGroupData) => {
    const [name, setName] = useState<string>(group.name);
    const [notes, setNotes] = useState<string>(group.notes ?? '');
    const [isEditing, setIsEditing] = useState<boolean>(false);

    const { actualStage: updateStage, run: updateGroup } = useDelayedPromiseState(useCallback(
        async () => {
            await GROUP_STORE.updateGroup(group.id, { name, notes });
            setIsEditing(false);
        },
        [group.id, name, notes]
    ));

    const canSaveOrCancelEditing = canUseControllingButton(updateStage);

    const onSaveClicked = useAccordionButtonHandler(() => {
        if (canSaveOrCancelEditing) {
            updateGroup();
        }
    });

    const onCancelClicked = useAccordionButtonHandler(() => {
        setName(group.name);
        setNotes(group.notes ?? '');
        setIsEditing(false);
    });

    const onEditClicked = useAccordionButtonHandler(() => {
        setIsEditing(true);
    });

    return {
        name,
        notes,
        isEditing,
        updateStage,
        canSaveOrCancelEditing,
        onNameChanged:  setName,
        onNotesChanged: setNotes,
        onEditClicked,
        onSaveClicked,
        onCancelClicked
    };
};

const useDeleteControls = (group: IGroupData) => {
    const { actualStage: deleteStage, run: deleteGroup } = useDelayedPromiseState(useCallback(
        () => GROUP_STORE.deleteGroup(group.id),
        [group.id]
    ));

    const onDeleteClicked = useAccordionButtonHandler(() => {
        deleteGroup();
    });

    const canUseDeleteButton = canUseControllingButton(deleteStage);

    return {
        deleteStage,
        onDeleteClicked,
        canUseDeleteButton
    };
};

export const Group: React.FC<IGroupProps> = ({ group }) => {
    const deleteControls = useDeleteControls(group);
    const editControls = useEditControls(group);

    return (
        <Accordion key={group.id}>
            <AccordionSummary>
                <div className="flex flex-between">
                    <GroupTypeIcon type={group.type}/>
                    <div className="flex-col flex-center">
                        {
                            editControls.isEditing && (
                                <>
                                    <input
                                        type="text"
                                        value={editControls.name}
                                        onChange={(e) => editControls.onNameChanged(e.target.value)}
                                        placeholder="Group Name"
                                    />
                                    <input
                                        type="text"
                                        value={editControls.notes}
                                        onChange={(e) => editControls.onNotesChanged(e.target.value)}
                                        placeholder="Notes"
                                    />
                                </>
                            )
                        }
                        {
                            !editControls.isEditing && (
                                <>
                                    <span>{group.name}</span>
                                    {
                                        group.notes && (
                                            <span className="subtitle">
                                                {group.notes}
                                            </span>
                                        )
                                    }
                                </>
                            )
                        }
                    </div>
                    <span className="badge">
                        {group.members.length}
                    </span>
                    {
                        editControls.isEditing && (
                            <>
                                <button
                                    className={classNames('material-symbols-outlined default-button default-container icon-container', promiseStageToButtonClass(editControls.updateStage))}
                                    disabled={!editControls.canSaveOrCancelEditing}
                                    onClick={editControls.onSaveClicked}
                                >
                                    check
                                </button>
                                <button
                                    className="material-symbols-outlined default-button default-container icon-container"
                                    disabled={!editControls.canSaveOrCancelEditing}
                                    onClick={editControls.onCancelClicked}
                                >
                                    close
                                </button>
                            </>
                        )
                    }
                    {
                        !editControls.isEditing && (
                            <>
                                <button
                                    className={classNames('material-symbols-outlined default-button default-container icon-container', promiseStageToButtonClass(deleteControls.deleteStage))}
                                    disabled={!deleteControls.canUseDeleteButton}
                                    onClick={deleteControls.onDeleteClicked}
                                >
                                    delete
                                </button>
                                <button
                                    className="material-symbols-outlined default-button default-container icon-container"
                                    disabled={!deleteControls.canUseDeleteButton}
                                    onClick={editControls.onEditClicked}
                                >
                                    edit
                                </button>
                            </>
                        )
                    }
                </div>
            </AccordionSummary>
            <AccordionDetails>
                <div className="flex-col">
                    <div className="flex flex-wrap">
                        {
                            group.members.map((member) => (
                                <GroupListItemMember
                                    key={`${member.type}-${member.id}`}
                                    groupId={group.id}
                                    member={member}
                                />
                            ))
                        }
                    </div>
                    <GroupAddMembers group={group}/>
                </div>
            </AccordionDetails>
        </Accordion>
    );
};