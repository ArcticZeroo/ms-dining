import { IGroupData } from '@msdining/common/models/group';
import React, { useCallback, useContext } from 'react';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { GroupMember } from './group-member.js';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { deleteGroup } from '../../../../api/client/groups.js';
import { classNames } from '../../../../util/react.js';
import { promiseStageToButtonClass } from '../../../../util/async.js';
import { GroupEventsContext } from '../../../../context/groups.js';

interface IGroupListItemProps {
    group: IGroupData;
}

export const GroupListItem: React.FC<IGroupListItemProps> = ({ group }) => {
    const groupEvents = useContext(GroupEventsContext);
    const { actualStage: deleteStage, run: deleteGroupCallback } = useDelayedPromiseState(useCallback(async () => {
        await deleteGroup(group.id)
        groupEvents.emit('groupDeleted', group.id);
    }, [groupEvents, group.id]));
    const canDelete = deleteStage !== PromiseStage.running && deleteStage !== PromiseStage.success;

    const onDeleteClicked = (event: React.MouseEvent) => {
        // Prevent accordion toggle when clicking delete
        event.preventDefault();
        event.stopPropagation();

        if (canDelete) {
            deleteGroupCallback();
        }
    }

    return (
        <Accordion key={group.id}>
            <AccordionSummary>
                <div className="flex flex-between">
                    <span>
                        {group.name} ({group.members.length} members)
                    </span>
                    <button
                        className={classNames("material-symbols-outlined default-button default-container icon-container", promiseStageToButtonClass(deleteStage))}
                        disabled={!canDelete}
                        onClick={onDeleteClicked}
                    >
                        delete
                    </button>
                </div>
            </AccordionSummary>
            <AccordionDetails>
                <div className="flex flex-wrap">
                    {
                        group.members.map((member) => (
                            <div className="card">
                                <GroupMember
                                    key={member.id}
                                    member={member}
                                />
                            </div>
                        ))
                    }
                </div>
            </AccordionDetails>
        </Accordion>
    );
};