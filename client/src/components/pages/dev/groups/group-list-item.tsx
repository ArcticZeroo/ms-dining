import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { IGroupData } from '@msdining/common/models/group';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import React, { useCallback } from 'react';
import { GROUP_STORE } from '../../../../store/groups.ts';
import { promiseStageToButtonClass } from '../../../../util/async.js';
import { classNames } from '../../../../util/react.js';
import { GroupMember } from './group-member.js';

interface IGroupListItemProps {
    group: IGroupData;
}

export const GroupListItem: React.FC<IGroupListItemProps> = ({ group }) => {
    const { actualStage: deleteStage, run: deleteGroupCallback } = useDelayedPromiseState(useCallback(
        () => GROUP_STORE.deleteGroup(group.id),
        [group.id]
    ));

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