import { IGroupData } from '@msdining/common/models/group';
import React, { useState } from 'react';
import { useAcceptCandidateMembers } from '../../../../store/queries/groups.ts';
import { mutationButtonClass } from '../../../../util/mutation.js';
import { classNames } from '../../../../util/react.js';
import { GroupMember } from './group-member/group-member.js';
import { GroupTypeIcon } from './group-type-icon.js';
import { CollapsibleContainer } from '../../../collapsible/collapsible-container.js';
import { CollapsibleHeader } from '../../../collapsible/collapsible-header.js';
import { CollapsibleBody } from '../../../collapsible/collapsible-body.js';

interface IGroupCandidateListItemProps {
    group: IGroupData;
}

export const GroupZeroContextCandidateListItem: React.FC<IGroupCandidateListItemProps> = ({ group }) => {
    const { name, type, members: possibleMembers } = group;
    const [acceptedMemberIds, setAcceptedMemberIds] = useState<ReadonlySet<string>>(() => new Set(possibleMembers.map((member) => member.id)));

    const isAcceptingAll = possibleMembers.length > 0 && acceptedMemberIds.size === possibleMembers.length;

    const acceptMutation = useAcceptCandidateMembers();

    const canAccept = !acceptMutation.isPending && acceptedMemberIds.size > 0;
    const canSelectMembers = !acceptMutation.isPending;

    const onAcceptGroupClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (!canAccept) {
            return;
        }

        acceptMutation.mutate(
            { candidate: group, acceptedMemberIds },
            { onSuccess: () => setAcceptedMemberIds(new Set()) },
        );
    };

    const onToggleMemberAccepted = (memberId: string) => {
        if (!canSelectMembers) {
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
        <CollapsibleContainer key={`${type}-${name}`}>
            <CollapsibleHeader>
                <div className="flex">
                    <GroupTypeIcon type={group.type}/>
                    <div>
                        {name} ({possibleMembers.length})
                    </div>
                    <div className="flex">
                        <button
                            className={classNames('default-container default-button flex flex-center', mutationButtonClass(acceptMutation), !canAccept && 'disabled')}
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
            </CollapsibleHeader>
            <CollapsibleBody>
                <div className="flex flex-wrap member-toggle">
                    {
                        possibleMembers.map(member => (
                            <button
                                key={member.id}
                                className={classNames('card pointer member', acceptedMemberIds.has(member.id) && 'active', !canSelectMembers && 'disabled')}
                                onClick={() => onToggleMemberAccepted(member.id)}
                                disabled={!canSelectMembers}
                            >
                                <GroupMember member={member}/>
                            </button>
                        ))
                    }
                </div>
            </CollapsibleBody>
        </CollapsibleContainer>
    );
};