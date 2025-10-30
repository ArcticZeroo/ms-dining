import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import React from 'react';
import { GroupZeroContextCandidateList } from './group-zero-context-candidate-list.js';
import { GroupList } from './group-list.js';
import './groups.css';

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
                    <GroupZeroContextCandidateList/>
                </AccordionDetails>
            </Accordion>
        </>
    );
}