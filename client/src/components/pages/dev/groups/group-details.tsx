import { IGroupData } from '@msdining/common/models/group';
import React from 'react';
import { type IGroupEditControls } from '../../../../hooks/group-controls.ts';

interface IGroupDetailsProps {
    group: IGroupData;
    editControls: IGroupEditControls;
}

export const GroupDetails: React.FC<IGroupDetailsProps> = ({ group, editControls }) => {
    return (
        <div className="flex-col flex-center">
            {
                editControls.isEditing && (
                    <>
                        <input
                            type="text"
                            value={editControls.name}
                            onChange={(event) => editControls.onNameChanged(event.target.value)}
                            placeholder="Group Name"
                        />
                        <input
                            type="text"
                            value={editControls.notes}
                            onChange={(event) => editControls.onNotesChanged(event.target.value)}
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
    );
};
