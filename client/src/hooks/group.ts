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
                const items = allItemsWithoutGroupByNormalizedName.get(normalizedName);
                if (items) {
                    suggestions.push(...items);
                }
            }

            return suggestions;
        },
        [allItemsWithoutGroupByNormalizedName, normalizedNames]
    );
}
