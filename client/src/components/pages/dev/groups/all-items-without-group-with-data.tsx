import React, { useMemo, useState } from 'react';
import { SearchEntityType } from '@msdining/common/models/search';
import { SearchEntityFilterType } from '../../../../models/search.js';
import { EntityTypeSelector } from '../../search/entity-type-selector.js';
import { AllItemsWithoutGroupByType } from '../../../../models/groups.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { IGroupMember } from '@msdining/common/models/group';
import { matchesEntityFilter } from '../../../../util/search.js';
import { pluralize } from '../../../../util/string.js';
import { GroupMember } from './group-member/group-member.js';
import { classNames } from '../../../../util/react.js';
import { AllItemsWithoutGroupSelectedPopup } from './all-items-without-group-selected-popup.js';

interface IAllItemsWithoutGroupWithDataProps {
    allItemsWithoutGroup: AllItemsWithoutGroupByType;
}

const useQueryResults = (allItemsWithoutGroup: AllItemsWithoutGroupByType, filter: SearchEntityFilterType, query: string) => {
    return useMemo(
        () => {
            const getResults = () => {
                const results: IGroupMember[] = [];
                const normalizedQuery = normalizeNameForSearch(query);
                for (const [entityType, itemsForType] of allItemsWithoutGroup) {
                    if (!matchesEntityFilter(filter, entityType)) {
                        continue;
                    }

                    for (const item of itemsForType.values()) {
                        if (!normalizedQuery || normalizeNameForSearch(item.name).includes(normalizedQuery)) {
                            results.push(item);
                        }
                    }
                }
                return results;
            };

            const results = getResults();
            results.sort((a, b) => a.name.localeCompare(b.name));
            return results;
        },
        [allItemsWithoutGroup, filter, query]
    );
}

const useSelectedMembers = () => {
    const [selectedMembers, setSelectedMembers] = useState<Map<string, IGroupMember>>(new Map());
    const [selectedType, setSelectedType] = useState<SearchEntityType | null>(null);

    const toggleSelectedItem = (item: IGroupMember) => {
        if (selectedType && selectedType !== item.type) {
            return;
        }

        const newSelectedMembers = new Map(selectedMembers);
        if (newSelectedMembers.has(item.id)) {
            newSelectedMembers.delete(item.id);
        } else {
            newSelectedMembers.set(item.id, item);
        }

        if (newSelectedMembers.size === 0) {
            setSelectedType(null);
        } else {
            setSelectedType(item.type);
        }

        setSelectedMembers(newSelectedMembers);
    }

    const clearSelection = () => {
        setSelectedMembers(new Map());
        setSelectedType(null);
    }

    return {
        selectedMembers,
        selectedType,
        toggleSelectedItem,
        clearSelection
    };
}

export const AllItemsWithoutGroupWithData: React.FC<IAllItemsWithoutGroupWithDataProps> = ({ allItemsWithoutGroup }) => {
    const [filter, setFilter] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);
    const [query, setQuery] = useState<string>('');
    const { selectedMembers, selectedType, toggleSelectedItem, clearSelection } = useSelectedMembers();

    const [tabCounts, totalCount] = useMemo(
        () => {
            const counts = new Map<SearchEntityType, number>();
            let totalCount = 0;
            for (const [entityType, itemsMap] of allItemsWithoutGroup.entries()) {
                counts.set(entityType, itemsMap.size);
                totalCount += itemsMap.size;
            }
            return [counts, totalCount];
        },
        [allItemsWithoutGroup]
    );

    const queryResults = useQueryResults(allItemsWithoutGroup, filter, query);

    return (
        <div className="flex-col align-center">
            <EntityTypeSelector
                selectedType={filter}
                onSelectedTypeChanged={setFilter}
                showTypesWithZeroCount={false}
                tabCounts={tabCounts}
            />
            <div>
                <input
                    type="text"
                    placeholder="Search items..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            <div>
                Showing {queryResults.length} of {totalCount} {pluralize('item', totalCount)}
            </div>
            <div className="flex flex-wrap member-toggle">
                {
                    queryResults.map((item) => {
                        const isDisabled = selectedType != null && selectedType !== item.type;
                        return (
                            <button
                                className={classNames('card self-stretch member', !isDisabled && 'pointer', selectedMembers.has(item.id) && 'active')}
                                onClick={() => toggleSelectedItem(item)}
                                disabled={isDisabled}
                            >
                                <GroupMember
                                    key={`${item.type}-${item.id}`}
                                    member={item}
                                />
                            </button>
                        );
                    })
                }
            </div>
            {
                selectedMembers.size > 0 && (
                    <AllItemsWithoutGroupSelectedPopup
                        selectedMembers={selectedMembers}
                        selectedType={selectedType!}
                        onClearSelection={clearSelection}
                    />
                )
            }
        </div>
    );
}