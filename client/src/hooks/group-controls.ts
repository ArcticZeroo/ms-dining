import { IGroupData } from '@msdining/common/models/group';
import { useCallback, useState, type MouseEvent } from 'react';
import { useDeleteGroup, useUpdateGroup } from '../store/queries/groups.ts';
import { canUseMutationButton, mutationButtonClass } from '../util/mutation.js';

export interface IGroupEditControls {
    name: string;
    notes: string;
    isEditing: boolean;
    updateButtonClass: string;
    canSaveOrCancelEditing: boolean;
    onNameChanged: (name: string) => void;
    onNotesChanged: (notes: string) => void;
    onEditClicked: (event: MouseEvent) => void;
    onSaveClicked: (event: MouseEvent) => void;
    onCancelClicked: (event: MouseEvent) => void;
}

export interface IGroupDeleteControls {
    deleteButtonClass: string;
    canUseDeleteButton: boolean;
    onDeleteClicked: (event: MouseEvent) => void;
}

const useAccordionButtonHandler = (handler?: (event: MouseEvent) => void) => {
    return useCallback((event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handler?.(event);
    }, [handler]);
};

export const useGroupEditControls = (group: IGroupData): IGroupEditControls => {
    const [name, setName] = useState<string>(group.name);
    const [notes, setNotes] = useState<string>(group.notes ?? '');
    const [isEditing, setIsEditing] = useState<boolean>(false);

    const updateMutation = useUpdateGroup();

    const canSaveOrCancelEditing = canUseMutationButton(updateMutation);

    const onSaveClicked = useAccordionButtonHandler(() => {
        if (!canSaveOrCancelEditing) {
            return;
        }
        updateMutation.mutate(
            { groupId: group.id, request: { name, notes } },
            { onSuccess: () => setIsEditing(false) },
        );
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
        updateButtonClass: mutationButtonClass(updateMutation),
        canSaveOrCancelEditing,
        onNameChanged:    setName,
        onNotesChanged:   setNotes,
        onEditClicked,
        onSaveClicked,
        onCancelClicked,
    };
};

export const useGroupDeleteControls = (group: IGroupData): IGroupDeleteControls => {
    const deleteMutation = useDeleteGroup();

    const onDeleteClicked = useAccordionButtonHandler(() => {
        deleteMutation.mutate({ groupId: group.id });
    });

    return {
        deleteButtonClass:  mutationButtonClass(deleteMutation),
        canUseDeleteButton: canUseMutationButton(deleteMutation),
        onDeleteClicked,
    };
};
