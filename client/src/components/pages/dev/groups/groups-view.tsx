import React from 'react';
import { GroupList } from './group-list.js';
import { GroupZeroContextCandidateList } from './group-zero-context-candidate-list.js';
import './groups.css';

export const GroupsView: React.FC = () => {
    return (
        <>
            <div className="flex-col">
                <GroupList/>
                <GroupZeroContextCandidateList/>
            </div>
        </>
    );
}