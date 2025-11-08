import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { useMemo } from 'react';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { useValueNotifier } from './events.js';
import { GROUP_STORE } from '../store/groups.js';

export const useSuggestedGroupMembers = (group: IGroupData) => {
    const normalizedNames = useMemo(
        () => new Set(group.members.map(member => normalizeNameForSearch(member.name))),
        [group.members]
    );

    const allItemsWithoutGroupByNormalizedName = useValueNotifier(GROUP_STORE.allItemsWithoutGroupByNormalizedName);

    return useMemo(
        () => {
            if (!allItemsWithoutGroupByNormalizedName) {
                return [];
            }

            const suggestions: IGroupMember[] = [];
            for (const normalizedName of normalizedNames) {
                const items = allItemsWithoutGroupByNormalizedName.get(normalizedName) ?? [];
                for (const item of items) {
                    if (item.type === group.type) {
                        suggestions.push(item);
                    }
                }
            }

            return suggestions;
        },
        [allItemsWithoutGroupByNormalizedName, group.type, normalizedNames]
    );
}

export const useSuggestedGroupMembersForAllGroups = (groups: IGroupData[]) => {
    const allItemsWithoutGroupByNormalizedName = useValueNotifier(GROUP_STORE.allItemsWithoutGroupByNormalizedName);
    return useMemo(
        () => {
            if (!allItemsWithoutGroupByNormalizedName) {
                return new Map<string, Array<IGroupMember>>();
            }

            const groupSuggestionsById = new Map<string, Array<IGroupMember>>();

            for (const group of groups) {
                const normalizedNames = new Set(
                    group.members.map(member => normalizeNameForSearch(member.name))
                );

                const suggestions: IGroupMember[] = [];
                for (const normalizedName of normalizedNames) {
                    const items = allItemsWithoutGroupByNormalizedName.get(normalizedName) ?? [];
                    for (const item of items) {
                        if (item.type === group.type) {
                            suggestions.push(item);
                        }
                    }
                }

                groupSuggestionsById.set(group.id, suggestions);
            }

            return groupSuggestionsById;
        },
        [allItemsWithoutGroupByNormalizedName, groups]
    );
}