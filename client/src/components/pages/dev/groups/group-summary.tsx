import { IGroupData } from '@msdining/common/models/group';
import React from 'react';
import { type IGroupEditControls } from '../../../../hooks/group-controls.ts';
import { pluralize } from '../../../../util/string.js';
import { GroupDetails } from './group-details.js';
import { GroupTypeIcon } from './group-type-icon.js';

interface IGroupSummaryProps {
    group: IGroupData;
    editControls: IGroupEditControls;
}

export const GroupSummary: React.FC<IGroupSummaryProps> = ({ group, editControls }) => {
    return (
        <div className="flex">
            <GroupTypeIcon type={group.type}/>
            <GroupDetails
                group={group}
                editControls={editControls}
            />
            <span className="text-badge">
                {group.members.length} {pluralize('Member', group.members.length)}
            </span>
        </div>
    );
};
