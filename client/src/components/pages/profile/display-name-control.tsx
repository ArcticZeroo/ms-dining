import { DISPLAY_NAME_MAX_LENGTH_CHARS, IClientUser } from '@msdining/common/models/auth';
import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { DiningClient } from '../../../api/client/dining.ts';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { classNames } from '../../../util/react.ts';
import { normalizeDisplayName } from '@msdining/common/util/string-util';

interface IDisplayNameControlProps {
    user: IClientUser;
}

export const DisplayNameControl: React.FC<IDisplayNameControlProps> = ({ user }) => {
    const [userDisplayName, setUserDisplayName] = useState(user.displayName);
    const [isEditActive, setEditActive] = useState(false);
    const [editDisplayNameValue, setEditDisplayNameValue] = useState(user.displayName);

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

    useEffect(() => {
        setEditDisplayNameValue(userDisplayName);
        saveMutation.reset();
        // saveMutation.reset is a stable function from useMutation
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditActive, userDisplayName]);

    if (isEditActive) {
        const isCurrentlySaving = saveMutation.isPending;

        const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const value = event.target.value;

            if (value.length > DISPLAY_NAME_MAX_LENGTH_CHARS) {
                return;
            }

            setEditDisplayNameValue(value);
        }

        const onCancel = () => {
            if (isCurrentlySaving) {
                return;
            }

            setEditActive(false);
        }

        const onSave = (event: React.FormEvent) => {
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
        }

        return (
            <form className="flex" onSubmit={onSave}>
                <input
                    type="text"
                    value={editDisplayNameValue}
                    onChange={onChange}
                    maxLength={DISPLAY_NAME_MAX_LENGTH_CHARS}
                    className="flex-grow default-container"
                />
                <div style={{ visibility: isCurrentlySaving ? 'visible' : 'hidden' }}>
                    <HourglassLoadingSpinner/>
                </div>
                <div className="flex">
                    <button type="button" onClick={onCancel} className="default-button default-container flex" disabled={isCurrentlySaving}>
                        <span className="material-symbols-outlined">
                            close
                        </span>
                        <span>
                            Cancel
                        </span>
                    </button>
                    <button type="submit" className={classNames("default-button default-container flex", saveMutation.isError && 'error')} disabled={isCurrentlySaving}>
                        <span className="material-symbols-outlined">
                            save
                        </span>
                        <span>
                            Save
                        </span>
                    </button>
                </div>
            </form>
        );
    }

    const onStartEdit = () => {
        setEditDisplayNameValue(userDisplayName);
        setEditActive(true);
    }

    return (
        <div onDoubleClick={onStartEdit} className="flex">
            <span className="flex-grow">
                {userDisplayName}
            </span>
            <button onClick={onStartEdit} className="default-button default-container flex">
                <span className="material-symbols-outlined">
                    edit
                </span>
                <span>
                    Edit
                </span>
            </button>
        </div>
    );
}