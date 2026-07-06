import { IClientUser } from '@msdining/common/models/auth';
import React from 'react';
import { useDisplayNameEditor } from '../../../hooks/display-name-editor.ts';
import { DisplayNameDisplay } from './display-name-display.tsx';
import { DisplayNameEditForm } from './display-name-edit-form.tsx';

interface IDisplayNameControlProps {
    user: IClientUser;
}

export const DisplayNameControl: React.FC<IDisplayNameControlProps> = ({ user }) => {
    const editor = useDisplayNameEditor(user.displayName);

    if (editor.isEditActive) {
        return (
            <DisplayNameEditForm
                displayNameValue={editor.editDisplayNameValue}
                hasSaveError={editor.hasSaveError}
                isCurrentlySaving={editor.isCurrentlySaving}
                onCancel={editor.onCancel}
                onChange={editor.onChange}
                onSave={editor.onSave}
            />
        );
    }

    return (
        <DisplayNameDisplay
            displayName={editor.userDisplayName}
            onStartEdit={editor.onStartEdit}
        />
    );
};
