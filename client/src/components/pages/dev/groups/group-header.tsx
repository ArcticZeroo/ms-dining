import { IGroupData } from '@msdining/common/models/group';
import React from 'react';
import {
    useGroupDeleteControls,
    useGroupEditControls,
} from '../../../../hooks/group-controls.ts';
import { pluralize } from '../../../../util/string.js';
import { GroupActions } from './group-actions.js';
import { GroupSummary } from './group-summary.js';

interface IGroupHeaderProps {
    group: IGroupData;
    suggestedMemberCount: number;
}

export const GroupHeader: React.FC<IGroupHeaderProps> = ({ group, suggestedMemberCount }) => {
    const editControls = useGroupEditControls(group);
    const deleteControls = useGroupDeleteControls(group);

    return (
        <div className="flex flex-between flex-grow">
            <GroupSummary
                group={group}
                editControls={editControls}
            />
            {
                suggestedMemberCount > 0 && (
                    <span className="text-badge">
                        {suggestedMemberCount} Suggested {pluralize('Member', suggestedMemberCount)}
                    </span>
                )
            }
            <GroupActions
                editControls={editControls}
                deleteControls={deleteControls}
            />
        </div>
    );
};
