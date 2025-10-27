import React, { useCallback, useContext, useEffect, useState } from 'react';
import { IGroupData } from '@msdining/common/models/group';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { GroupMember } from './group-member.js';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { addGroupMembers, createGroup } from '../../../../api/client/groups.js';
import { classNames } from '../../../../util/react.js';
import { promiseStageToButtonClass } from '../../../../util/async.js';
import { GroupEventsContext } from '../../../../context/groups.js';

interface IGroupCandidateProps {
    group: IGroupData;
    onAcceptedAll: () => void;
}

export const GroupCandidate: React.FC<IGroupCandidateProps> = ({ group: { name, members, type }, onAcceptedAll }) => {
    const groupEvents = useContext(GroupEventsContext);
    const [possibleMemberIds, setPossibleMemberIds] = useState<ReadonlySet<string>>(new Set());
    const [acceptedMemberIds, setAcceptedMemberIds] = useState<ReadonlySet<string>>(() => new Set(members.map((member) => member.id)));
    const [groupId, setGroupId] = useState<string | null>(null);

    useEffect(() => {
        const newPossibleMemberIds = new Set(members.map((member) => member.id));
        setPossibleMemberIds(newPossibleMemberIds);
        setAcceptedMemberIds(new Set(Array.from(newPossibleMemberIds).filter((id) => newPossibleMemberIds.has(id))));
    }, [members]);

    const isAcceptingAll = possibleMemberIds.size > 0 && acceptedMemberIds.size === possibleMemberIds.size;

    const { actualStage: acceptStage, run: acceptGroup } = useDelayedPromiseState(useCallback(async () => {
        if (groupId) {
            await addGroupMembers(groupId, Array.from(acceptedMemberIds));
        } else {
            const { id } = await createGroup({
                name,
                entityType:     type,
                initialMembers: Array.from(acceptedMemberIds)
            });

            groupEvents.emit('groupCreated', {
                id,
                name,
                type,
                members: members.filter((member) => acceptedMemberIds.has(member.id))
            });

            setGroupId(id);
        }

        if (isAcceptingAll) {
            setPossibleMemberIds(new Set());
            onAcceptedAll();
        } else {
            setPossibleMemberIds(new Set(Array.from(possibleMemberIds).filter((id) => !acceptedMemberIds.has(id))));
        }

        setAcceptedMemberIds(new Set());
    }, [groupId, isAcceptingAll, acceptedMemberIds, members, name, groupEvents, onAcceptedAll, possibleMemberIds]));

    const canAccept = acceptStage === PromiseStage.notRun || acceptStage === PromiseStage.error;

    const onAcceptGroupClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

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
                <div className="flex flex-between">
                    <div>
                        {name} ({members.length})
                    </div>
                    <div className="flex">
                        <button
                            className={classNames('default-container default-button flex flex-center', promiseStageToButtonClass(acceptStage), !canAccept && 'disabled')}
                            onClick={onAcceptGroupClicked}
                            disabled={!canAccept}
                        >
                            <span>
                                Accept {isAcceptingAll && 'all '}{acceptedMemberIds.size} into group called "{name}"
                            </span>
                            <span className="material-symbols-outlined">
                                group_add
                            </span>
                        </button>
                    </div>

                </div>
            </AccordionSummary>
            <AccordionDetails>
                <div className="flex flex-wrap member-toggle">
                    {members.map(member => (
                        possibleMemberIds.has(member.id) && (
                            <button
                                key={member.id}
                                className={classNames('card default-button member', acceptedMemberIds.has(member.id) && 'active', !canAccept && 'disabled')}
                                onClick={() => onToggleMemberAccepted(member.id)}
                                disabled={!canAccept}
                            >
                                <GroupMember member={member}/>
                            </button>
                        )))}
                </div>
            </AccordionDetails>
        </Accordion>
    );
};