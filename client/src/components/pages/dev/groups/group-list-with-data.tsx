import { IGroupData } from '@msdining/common/models/group';
import React, { useMemo, useState } from 'react';
import { SearchEntityFilterType, SearchEntityType } from '@msdining/common/models/search';
import { Group } from './group.js';
import { useSuggestedGroupMembersForAllGroups } from '../../../../hooks/group.js';
import { matchesEntityFilter } from '../../../../util/search.js';
import { EntityTypeSelector } from '../../search/entity-type-selector.js';

interface IGroupListWithDataProps {
    groups: IGroupData[];
}

const useGroupsByEntityType = (groups: IGroupData[]) => {
    return useMemo(() => {
        const map = new Map<SearchEntityType, Array<IGroupData>>();

        for (const group of groups) {
            if (!map.has(group.type)) {
                map.set(group.type, []);
            }
            map.get(group.type)!.push(group);
        }

        return map;
    }, [groups]);
}

const useGroupsForFilter = (groupsByType: Map<SearchEntityType, Array<IGroupData>>, filter: SearchEntityFilterType) => {
    return useMemo(() => {
        const groups: IGroupData[] = [];
        for (const [entityType, groupsForType] of groupsByType.entries()) {
            if (matchesEntityFilter(filter, entityType)) {
                groups.push(...groupsForType);
            }
        }
        groups.sort((a, b) => a.name.localeCompare(b.name));
        return groups;
    }, [filter, groupsByType]);
}

export const GroupListWithData: React.FC<IGroupListWithDataProps> = ({ groups }) => {
    const [filter, setFilter] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);
    const groupsByType = useGroupsByEntityType(groups);
    const groupsForSelectedType = useGroupsForFilter(groupsByType, filter);
    const suggestedGroupMembers = useSuggestedGroupMembersForAllGroups(groups);
    const [onlySuggested, setOnlySuggested] = useState(false);

    const tabCounts = useMemo(() => {
        const counts = new Map<SearchEntityType, number>();
        for (const [entityType, groupsForType] of groupsByType.entries()) {
            counts.set(entityType, groupsForType.length);
        }
        return counts;
    }, [groupsByType]);

    const groupMembers = groupsForSelectedType.map((group) => {
        const suggestedMemberCount = suggestedGroupMembers.get(group.id)?.length ?? 0;
        if (onlySuggested && suggestedMemberCount === 0) {
            return null;
        }

        return (
            <Group
                key={group.id}
                group={group}
                suggestedMemberCount={suggestedMemberCount}
            />
        );
    });

    const isEmpty = groupMembers.every((member) => member === null);

    return (
        <div className="flex-col">
            <div className="flex">
                <EntityTypeSelector
                    selectedType={filter}
                    onSelectedTypeChanged={setFilter}
                    showTypesWithZeroCount={false}
                    tabCounts={tabCounts}
                />
                <div className="flex">
                    <input
                        id="suggested-only-checkbox"
                        type="checkbox"
                        checked={onlySuggested}
                        onChange={(event) => setOnlySuggested(event.target.checked)}
                    />
                    <label htmlFor="suggested-only-checkbox">
                        Only Groups With Suggested Members
                    </label>
                </div>
            </div>
            <div className="flex-col">
                {
                    groupMembers
                }
                {
                    isEmpty && 'No groups to display.'
                }
            </div>
        </div>
    );
}