import React, { useCallback } from 'react';
import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { useValueNotifier } from '../../../../hooks/events.js';
import { GROUP_STORE } from '../../../../store/groups.js';
import { RetryButton } from '../../../button/retry-button.js';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
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
    allItemsWithoutGroupStage: PromiseStage;
    onRetryClicked: () => void;
}

const GroupAddMembersBody: React.FC<IGroupAddMembersBodyProps> = ({ group, allItemsWithoutGroup, suggestedCandidates, allItemsWithoutGroupStage, onRetryClicked }) => {
    if (allItemsWithoutGroup && suggestedCandidates) {
        return (
            <GroupAddMembersWithData
                allItemsWithoutGroup={allItemsWithoutGroup}
                suggestedCandidates={suggestedCandidates}
                group={group}
            />
        );
    }

    if (allItemsWithoutGroupStage === PromiseStage.error) {
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
    const { stage: allItemsWithoutGroupStage, value: allItemsWithoutGroup, run: retryGetAllItemsWithoutGroup } = useValueNotifier(GROUP_STORE.allItemsWithoutGroup);
    const suggestedCandidates = useSuggestedGroupMembers(group);

    const onRetryClicked = useCallback(() => {
        if (allItemsWithoutGroupStage === PromiseStage.error) {
            retryGetAllItemsWithoutGroup();
        }
    }, [allItemsWithoutGroupStage, retryGetAllItemsWithoutGroup]);

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
                    allItemsWithoutGroupStage={allItemsWithoutGroupStage}
                    onRetryClicked={onRetryClicked}
                />
            </CollapsibleBody>
        </CollapsibleContainer>
    );
};