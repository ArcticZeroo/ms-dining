import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { useMemo } from 'react';
import { useItemsWithoutGroupByNormalizedName } from '../store/queries/groups.ts';

export const useSuggestedGroupMembers = (group: IGroupData) => {
    const normalizedNames = useMemo(
        () => new Set(group.members.map(member => normalizeNameForSearch(member.name))),
        [group.members]
    );

    const { data: itemsByNormalizedName } = useItemsWithoutGroupByNormalizedName();

    return useMemo(
        () => {
            if (!itemsByNormalizedName) {
                return [];
            }

            const suggestions: IGroupMember[] = [];
            for (const normalizedName of normalizedNames) {
                const items = itemsByNormalizedName.get(normalizedName) ?? [];
                for (const item of items) {
                    if (item.type === group.type) {
                        suggestions.push(item);
                    }
                }
            }

            return suggestions;
        },
        [itemsByNormalizedName, group.type, normalizedNames]
    );
}

export const useSuggestedGroupMembersForAllGroups = (groups: IGroupData[]) => {
    const { data: itemsByNormalizedName } = useItemsWithoutGroupByNormalizedName();
    return useMemo(
        () => {
            if (!itemsByNormalizedName) {
                return new Map<string, Array<IGroupMember>>();
            }

            const groupSuggestionsById = new Map<string, Array<IGroupMember>>();

            for (const group of groups) {
                const normalizedNames = new Set(
                    group.members.map(member => normalizeNameForSearch(member.name))
                );

                const suggestions: IGroupMember[] = [];
                for (const normalizedName of normalizedNames) {
                    const items = itemsByNormalizedName.get(normalizedName) ?? [];
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
        [itemsByNormalizedName, groups]
    );
}