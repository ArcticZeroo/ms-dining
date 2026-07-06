import { DISPLAY_NAME_MAX_LENGTH_CHARS } from '@msdining/common/models/auth';
import { normalizeDisplayName } from '@msdining/common/util/string-util';
import { useMutation } from '@tanstack/react-query';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { DiningClient } from '../api/client/dining.ts';

interface IDisplayNameEditor {
    editDisplayNameValue: string;
    hasSaveError: boolean;
    isCurrentlySaving: boolean;
    isEditActive: boolean;
    onCancel: () => void;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onSave: (event: FormEvent) => void;
    onStartEdit: () => void;
    userDisplayName: string;
}

export const useDisplayNameEditor = (initialDisplayName: string): IDisplayNameEditor => {
    const [userDisplayName, setUserDisplayName] = useState(initialDisplayName);
    const [isEditActive, setEditActive] = useState(false);
    const [editDisplayNameValue, setEditDisplayNameValue] = useState(initialDisplayName);

    const saveMutation = useMutation<void, Error, string>({
        mutationFn: (value) => DiningClient.updateMyDisplayName(value),
        onSuccess:  (_void, value) => {
            setUserDisplayName(value);
            setEditActive(false);
        },
        onError: (err) => {
            console.error('Failed to update display name:', err);
        },
    });

    const isCurrentlySaving = saveMutation.isPending;

    useEffect(() => {
        setEditDisplayNameValue(userDisplayName);
        saveMutation.reset();
        // saveMutation.reset is a stable function from useMutation
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditActive, userDisplayName]);

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;

        if (value.length > DISPLAY_NAME_MAX_LENGTH_CHARS) {
            return;
        }

        setEditDisplayNameValue(value);
    };

    const onCancel = () => {
        if (isCurrentlySaving) {
            return;
        }

        setEditActive(false);
    };

    const onSave = (event: FormEvent) => {
        event.preventDefault();

        if (isCurrentlySaving) {
            return;
        }

        const valueToSet = normalizeDisplayName(editDisplayNameValue);

        if (valueToSet === userDisplayName) {
            setEditActive(false);
            return;
        }

        saveMutation.mutate(valueToSet);
    };

    const onStartEdit = () => {
        setEditDisplayNameValue(userDisplayName);
        setEditActive(true);
    };

    return {
        editDisplayNameValue,
        hasSaveError: saveMutation.isError,
        isCurrentlySaving,
        isEditActive,
        onCancel,
        onChange,
        onSave,
        onStartEdit,
        userDisplayName,
    };
};
