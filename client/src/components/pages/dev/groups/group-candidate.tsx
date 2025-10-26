import React from 'react';
import { IGroupMember } from '@msdining/common/models/group';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { GroupMember } from './group-member.js';

interface IGroupCandidateProps {
    name: string;
    members: IGroupMember[];
}

export const GroupCandidate: React.FC<IGroupCandidateProps> = ({ name, members }) => {
    return (
        <Accordion key={`${members[0]!.type}-${name}`}>
            <AccordionSummary>
                {name} ({members.length})
            </AccordionSummary>
            <AccordionDetails>
                <div className="flex">
                    <button className="default-container default-button flex-center">
                        <span>
                            Accept all into group called "{name}"
                        </span>
                        <span className="material-symbols-outlined">
                            group_add
                        </span>
                    </button>
                </div>
                <div className="flex flex-wrap">
                    {members.map(member => (
                        <GroupMember member={member} key={member.id}/>
                    ))}
                </div>
            </AccordionDetails>
        </Accordion>
    );
};