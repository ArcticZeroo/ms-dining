import { IGroupData } from '@msdining/common/models/group';
import React from 'react';
import { CollapsibleBody } from '../../../collapsible/collapsible-body.js';
import { CollapsibleHeader } from '../../../collapsible/collapsible-header.js';
import { GroupAddMembers } from './group-add-members.js';
import { GroupCard } from './group-card.js';
import { GroupHeader } from './group-header.js';
import { GroupMemberList } from './group-member-list.js';

interface IGroupProps {
    group: IGroupData;
    suggestedMemberCount: number;
}

export const Group: React.FC<IGroupProps> = ({ group, suggestedMemberCount }) => {
    return (
        <GroupCard>
            <CollapsibleHeader>
                <GroupHeader
                    group={group}
                    suggestedMemberCount={suggestedMemberCount}
                />
            </CollapsibleHeader>
            <CollapsibleBody>
                <div className="flex-col">
                    <GroupMemberList group={group}/>
                    <GroupAddMembers group={group}/>
                </div>
            </CollapsibleBody>
        </GroupCard>
    );
};
