import type { SearchEntityType } from '@msdining/common/models/search';
import React from 'react';
import { SearchEntityFilterType } from '../../../models/search.ts';
import { classNames } from '../../../util/react.ts';
import { SearchFilters } from '../../search/filters/search-filters.tsx';
import { SearchWaiting } from '../../search/search-waiting.tsx';
import { EntityTypeSelector } from './entity-type-selector.js';

interface ISearchPageHeaderProps {
    entityFilterType: SearchEntityFilterType;
    isFetching: boolean;
    isFilterMenuOpen: boolean;
    onFilterMenuToggled: () => void;
    onSelectedTypeChanged: (type: SearchEntityFilterType) => void;
    queryText: string;
    tabCounts: Map<SearchEntityType, number>;
}

export const SearchPageHeader: React.FC<ISearchPageHeaderProps> = ({
    entityFilterType,
    isFetching,
    isFilterMenuOpen,
    onFilterMenuToggled,
    onSelectedTypeChanged,
    queryText,
    tabCounts,
}) => {
    return (
        <div className="search-page-header">
            <div className="search-info flex flex-col default-container">
                <div className="query flex flex-between default-container">
                    <span className="icon-sized"/>
                    <span>
                        "{queryText}"
                    </span>
                    <SearchWaiting isPending={isFetching}/>
                </div>
                <div className="flex">
                    <button
                        className={classNames('search-filters-button default-container flex transition-background', isFilterMenuOpen && 'open')}
                        onClick={onFilterMenuToggled}>
                        <span className="material-symbols-outlined icon">
                            filter_list
                        </span>
                        <span>
                            Filters
                        </span>
                    </button>
                    <EntityTypeSelector
                        selectedType={entityFilterType}
                        onSelectedTypeChanged={onSelectedTypeChanged}
                        showTypesWithZeroCount={true}
                        tabCounts={tabCounts}
                    />
                </div>
                {
                    isFilterMenuOpen && (
                        <SearchFilters/>
                    )
                }
            </div>
        </div>
    );
};
