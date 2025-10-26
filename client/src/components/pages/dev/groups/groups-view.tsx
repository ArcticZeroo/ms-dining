import React from 'react';
import { GroupList } from './group-list.js';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { GroupCandidates } from './group-candidates.js';

export const GroupsView: React.FC = () => {
    return (
        <>
            <Accordion>
                <AccordionSummary>
                    Group List
                </AccordionSummary>
                <AccordionDetails>
                    <GroupList/>
                </AccordionDetails>
            </Accordion>
            <Accordion>
                <AccordionSummary>
                    Group Candidates
                </AccordionSummary>
                <AccordionDetails>
                    <GroupCandidates/>
                </AccordionDetails>
            </Accordion>
        </>
    );
}