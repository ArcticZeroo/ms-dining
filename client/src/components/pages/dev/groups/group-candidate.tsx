import React, { useCallback, useState } from 'react';
import { IGroupMember } from '@msdining/common/models/group';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { GroupMember } from './group-member.js';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { createGroup } from '../../../../api/client/groups.js';
import { classNames } from '../../../../util/react.js';
import { promiseStageToButtonClass } from '../../../../util/async.js';

interface IGroupCandidateProps {
    name: string;
    members: IGroupMember[];
}

export const GroupCandidate: React.FC<IGroupCandidateProps> = ({ name, members }) => {
    const [acceptedMemberIds, setAcceptedMemberIds] = useState<ReadonlySet<string>>(() => new Set(members.map((member) => member.id)));

    const { actualStage: acceptStage, run: acceptGroup } = useDelayedPromiseState(useCallback(() => {
        return createGroup({
            name,
            entityType:     members[0]!.type,
            initialMembers: members.map(member => member.id)
        });
    }, [name, members]));

    const canAccept = acceptStage === PromiseStage.notRun || acceptStage === PromiseStage.error;

    const onAcceptGroupClicked = () => {
        if (!canAccept) {
            return;
        }

        acceptGroup();
    };

    const onToggleMemberAccepted = (memberId: string) => {
        if (!canAccept) {
            return;
        }

        setAcceptedMemberIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(memberId)) {
                newSet.delete(memberId);
            } else {
                newSet.add(memberId);
            }
            return newSet;
        });
    };

    return (
        <Accordion key={`${members[0]!.type}-${name}`}>
            <AccordionSummary>
                {name} ({members.length})
            </AccordionSummary>
            <AccordionDetails>
                <div className="flex-col">
                    <div className="flex">
                        <button
                            className={classNames('default-container default-button flex flex-center', promiseStageToButtonClass(acceptStage), !canAccept && 'disabled')}
                            onClick={onAcceptGroupClicked}
                            disabled={!canAccept}
                        >
                            <span>
                                Accept {acceptedMemberIds.size === members.length && 'all '}{acceptedMemberIds.size} into group called "{name}"
                            </span>
                            <span className="material-symbols-outlined">
                                group_add
                            </span>
                        </button>
                    </div>
                    <div className="flex flex-wrap member-toggle">
                        {members.map(member => (
                            <button
                                key={member.id}
                                className={classNames('card default-button member', acceptedMemberIds.has(member.id) && 'active', !canAccept && 'disabled')}
                                onClick={() => onToggleMemberAccepted(member.id)}
                                disabled={!canAccept}
                            >
                                <GroupMember member={member}/>
                            </button>
                        ))}
                    </div>
                </div>
            </AccordionDetails>
        </Accordion>
    );
};