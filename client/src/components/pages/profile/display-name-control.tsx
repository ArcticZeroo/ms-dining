import { DISPLAY_NAME_MAX_LENGTH_CHARS, IClientUser } from '@msdining/common/models/auth';
import React, { useEffect, useState } from 'react';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
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
    const [editSaveStage, setEditSaveStage] = useState(PromiseStage.notRun);

    useEffect(() => {
        setEditDisplayNameValue(userDisplayName);
        setEditSaveStage(PromiseStage.notRun);
    }, [isEditActive, userDisplayName]);

    if (isEditActive) {
        const isCurrentlySaving = editSaveStage === PromiseStage.running;

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

            setEditSaveStage(PromiseStage.running);
            DiningClient.updateMyDisplayName(valueToSet)
                .then(() => {
                    setUserDisplayName(valueToSet);
                    setEditActive(false);
                    setEditSaveStage(PromiseStage.notRun);
                })
                .catch(err => {
                    console.error('Failed to update display name:', err);
                    setEditSaveStage(PromiseStage.error);
                });
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
                    <button type="submit" className={classNames("default-button default-container flex", editSaveStage === PromiseStage.error && 'error')} disabled={isCurrentlySaving}>
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