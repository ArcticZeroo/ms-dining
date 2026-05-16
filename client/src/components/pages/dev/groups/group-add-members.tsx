import React, { useCallback } from 'react';
import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { useItemsWithoutGroup } from '../../../../store/queries/groups.ts';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GroupAddMembersWithData } from './group-add-members-with-data.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { pluralize } from '../../../../util/string.js';
import { CollapsibleContainer } from '../../../collapsible/collapsible-container.js';
import { CollapsibleHeader } from '../../../collapsible/collapsible-header.js';
import { CollapsibleBody } from '../../../collapsible/collapsible-body.js';
import { useSuggestedGroupMembers } from '../../../../hooks/group.js';

interface IGroupAddMembersProps {
    group: IGroupData;
}

interface IGroupAddMembersBodyProps {
    group: IGroupData;
    allItemsWithoutGroup: Map<SearchEntityType, Map<string, IGroupMember>> | undefined;
    suggestedCandidates: IGroupMember[] | undefined;
    isError: boolean;
    onRetryClicked: () => void;
}

const GroupAddMembersBody: React.FC<IGroupAddMembersBodyProps> = ({ group, allItemsWithoutGroup, suggestedCandidates, isError, onRetryClicked }) => {
    if (allItemsWithoutGroup && suggestedCandidates) {
        return (
            <GroupAddMembersWithData
                allItemsWithoutGroup={allItemsWithoutGroup}
                suggestedCandidates={suggestedCandidates}
                group={group}
            />
        );
    }

    if (isError) {
        return (
            <div>
                <span>
                    Failed to load items.
                </span>
                <RetryButton onClick={onRetryClicked}/>
            </div>
        )
    }

    return (
        <div className="flex flex-center">
            <span>
                Loading items...
            </span>
            <HourglassLoadingSpinner/>
        </div>
    );
}

export const GroupAddMembers: React.FC<IGroupAddMembersProps> = ({ group }) => {
    const { data: allItemsWithoutGroup, isError, refetch } = useItemsWithoutGroup();
    const suggestedCandidates = useSuggestedGroupMembers(group);

    const onRetryClicked = useCallback(() => {
        if (isError) {
            void refetch();
        }
    }, [isError, refetch]);

    let title = 'Search For New Group Members';
    if (suggestedCandidates && suggestedCandidates.length > 0) {
        title += ` (${suggestedCandidates.length} ${pluralize('suggested member', suggestedCandidates.length)})`;
    }

    return (
        <CollapsibleContainer>
            <CollapsibleHeader>
                <div className="flex flex-center">
                    <span className="material-symbols-outlined">
                        person_add
                    </span>
                    <span>
                        {title}
                    </span>
                </div>
            </CollapsibleHeader>
            <CollapsibleBody>
                <GroupAddMembersBody
                    group={group}
                    allItemsWithoutGroup={allItemsWithoutGroup}
                    suggestedCandidates={suggestedCandidates}
                    isError={isError}
                    onRetryClicked={onRetryClicked}
                />
            </CollapsibleBody>
        </CollapsibleContainer>
    );
};