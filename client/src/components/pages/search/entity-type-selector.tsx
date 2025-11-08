import { EntityButton } from './entity-button.js';
import { SearchEntityFilterType } from '../../../models/search.js';
import React, { useMemo } from 'react';
import { allSearchEntityTypes, SearchEntityType } from '@msdining/common/models/search';
import './entity-button.css';
import { entityDisplayDataByType } from '../../../constants/search.js';
import { joinCommaSeparatedList } from '../../../util/iterable.js';

interface IEntityTypeSelectorProps {
    selectedType: SearchEntityFilterType;
    onSelectedTypeChanged: (type: SearchEntityFilterType) => void;
    tabCounts: Map<SearchEntityType, number>;
    showTypesWithZeroCount?: boolean;
}

export const EntityTypeSelector: React.FC<IEntityTypeSelectorProps> = ({ selectedType, onSelectedTypeChanged, tabCounts, showTypesWithZeroCount = false }) => {
    const totalCount = useMemo(() => {
        let count = 0;
        for (const type of tabCounts.values()) {
            count += type;
        }
        return count;
    }, [tabCounts]);

    const sharedEntityButtonProps = {
        currentFilter:    selectedType,
        totalResultCount: totalCount,
        showIfEmpty: showTypesWithZeroCount,
        tabCounts,
    } as const;

    const allButtonLabel = useMemo(
        () => {
            if (showTypesWithZeroCount) {
                return 'Menu Items, Stations, and Cafes';
            }

            const names: string[] = [];
            for (const entityType of allSearchEntityTypes) {
                const count = tabCounts.get(entityType) ?? 0;
                if (count > 0) {
                    const displayData = entityDisplayDataByType[entityType];
                    names.push(`${displayData.displayName}s`);
                }
            }
            return joinCommaSeparatedList(names);
        },
        [showTypesWithZeroCount, tabCounts]
    );

    return (
        <div className="search-entity-selector">
            <EntityButton name={allButtonLabel}
                type={SearchEntityFilterType.all}
                onClick={() => onSelectedTypeChanged(SearchEntityFilterType.all)}
                {...sharedEntityButtonProps}
            />
            <EntityButton name="Menu Items Only"
                type={SearchEntityFilterType.menuItem}
                onClick={() => onSelectedTypeChanged(SearchEntityFilterType.menuItem)}
                {...sharedEntityButtonProps}
            />
            <EntityButton name="Stations Only"
                type={SearchEntityFilterType.station}
                onClick={() => onSelectedTypeChanged(SearchEntityFilterType.station)}
                {...sharedEntityButtonProps}
            />
            <EntityButton name="Cafes Only"
                type={SearchEntityFilterType.cafe}
                onClick={() => onSelectedTypeChanged(SearchEntityFilterType.cafe)}
                {...sharedEntityButtonProps}
            />
        </div>
    );
}