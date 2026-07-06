import { DISPLAY_NAME_MAX_LENGTH_CHARS } from '@msdining/common/models/auth';
import React from 'react';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { classNames } from '../../../util/react.ts';

interface IDisplayNameEditFormProps {
    displayNameValue: string;
    hasSaveError: boolean;
    isCurrentlySaving: boolean;
    onCancel: () => void;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: (event: React.FormEvent) => void;
}

export const DisplayNameEditForm: React.FC<IDisplayNameEditFormProps> = ({
    displayNameValue,
    hasSaveError,
    isCurrentlySaving,
    onCancel,
    onChange,
    onSave,
}) => {
    return (
        <form className="flex" onSubmit={onSave}>
            <input
                type="text"
                value={displayNameValue}
                onChange={onChange}
                maxLength={DISPLAY_NAME_MAX_LENGTH_CHARS}
                className="flex-grow default-container"
            />
            <div style={{ visibility: isCurrentlySaving ? 'visible' : 'hidden' }}>
                <HourglassLoadingSpinner/>
            </div>
            <div className="flex">
                <button
                    type="button"
                    onClick={onCancel}
                    className="default-button default-container flex"
                    disabled={isCurrentlySaving}
                >
                    <span className="material-symbols-outlined">
                        close
                    </span>
                    <span>
                        Cancel
                    </span>
                </button>
                <button
                    type="submit"
                    className={classNames('default-button default-container flex', hasSaveError && 'error')}
                    disabled={isCurrentlySaving}
                >
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
};
