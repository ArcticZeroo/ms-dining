import React, { useMemo } from 'react';
import { GroupList } from './group-list.js';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { GroupCandidates } from './group-candidates.js';
import './groups.css';
import { TypedEventEmitter } from '../../../../util/events.js';
import { GroupEvents, GroupEventsContext } from '../../../../context/groups.js';

export const GroupsView: React.FC = () => {
    const groupEvents = useMemo(() => new TypedEventEmitter<GroupEvents>(), []);

    return (
        <GroupEventsContext.Provider value={groupEvents}>
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
        </GroupEventsContext.Provider>
    );
}