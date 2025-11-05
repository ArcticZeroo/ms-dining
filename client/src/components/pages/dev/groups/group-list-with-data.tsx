import { IGroupData } from '@msdining/common/models/group';
import React, { useMemo, useState } from 'react';
import { allSearchEntityTypes, SearchEntityType } from '@msdining/common/models/search';
import { Group } from './group.js';
import { entityDisplayDataByType } from '../../../../constants/search.js';
import { classNames } from '../../../../util/react.js';

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

    return (
        <div className="flex-col">
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
                                <span className="badge">
                                    {groupsForType.length}
                                </span>
                            </button>
                        );
                    })
                }
            </div>
            <div className="flex-col">
                {
                    groupsForSelectedType.map((group) => (
                        <Group key={group.id} group={group}/>
                    ))
                }
            </div>
        </div>
    );
}