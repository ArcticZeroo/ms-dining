import { IGroupData } from '@msdining/common/models/group';
import React, { useMemo, useState } from 'react';
import { allSearchEntityTypes, SearchEntityType } from '@msdining/common/models/search';
import { Group } from './group.js';
import { entityDisplayDataByType } from '../../../../constants/search.js';
import { classNames } from '../../../../util/react.js';
import { useSuggestedGroupMembersForAllGroups } from '../../../../hooks/group.js';

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

export const GroupListWithData: React.FC<IGroupListWithDataProps> = ({ groups }) => {
    const [entityType, setEntityType] = useState<SearchEntityType>(SearchEntityType.menuItem);
    const groupsByType = useGroupsByEntityType(groups);
    const groupsForSelectedType = groupsByType.get(entityType) || [];
    const suggestedGroupMembers = useSuggestedGroupMembersForAllGroups(groups);
    const [onlySuggested, setOnlySuggested] = useState(false);

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
                <div className="flex tab-selector">
                    {
                        allSearchEntityTypes.map((buttonEntityType) => {
                            const groupsForType = groupsByType.get(buttonEntityType) || [];

                            if (groupsForType.length === 0) {
                                return null;
                            }

                            const displayData = entityDisplayDataByType[buttonEntityType];

                            return (
                                <button
                                    key={buttonEntityType}
                                    className={classNames(`tab-option flex`, buttonEntityType === entityType && 'active', displayData.className)}
                                    onClick={() => setEntityType(buttonEntityType)}
                                >
                                    <span>
                                        {displayData.displayName}
                                    </span>
                                    <span className="number-badge">
                                        {groupsForType.length}
                                    </span>
                                </button>
                            );
                        })
                    }
                </div>
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