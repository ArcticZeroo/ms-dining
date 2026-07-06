import React from 'react';
import { type IGroupDeleteControls, type IGroupEditControls } from '../../../../hooks/group-controls.ts';
import { classNames } from '../../../../util/react.js';

interface IGroupActionsProps {
    editControls: IGroupEditControls;
    deleteControls: IGroupDeleteControls;
}

export const GroupActions: React.FC<IGroupActionsProps> = ({ editControls, deleteControls }) => {
    return (
        <div className="flex">
            {
                editControls.isEditing && (
                    <>
                        <button
                            className={classNames('material-symbols-outlined default-button default-container icon-container', editControls.updateButtonClass)}
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
                            className={classNames('material-symbols-outlined default-button default-container icon-container', deleteControls.deleteButtonClass)}
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
    );
};
