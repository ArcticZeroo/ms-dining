import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchEntityFilterType, SearchEntityType } from '../../../models/search.ts';
import { SearchResultsList } from '../../search/search-results-list.tsx';
import { EntityButton } from './entity-button.tsx';
import { DiningClient } from '../../../api/dining.ts';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';

import './search-page.css';

interface ISearchPageWithQueryProps {
    queryText: string;
}

const matchesEntityFilter = (filter: SearchEntityFilterType, entryType: SearchEntityType) => {
    switch (filter) {
        case SearchEntityFilterType.all:
            return true;
        case SearchEntityFilterType.menuItem:
            return entryType === SearchEntityType.menuItem;
        case SearchEntityFilterType.station:
            return entryType === SearchEntityType.station;
        default:
            console.error('Unknown filter type', filter);
            return false;
    }
}

const useSearchResultsState = (query: string, entityFilterType: SearchEntityFilterType) => {
    const doSearchCallback = useCallback(() => DiningClient.retrieveSearchResults(query), [query]);
    const searchResultState = useDelayedPromiseState(doSearchCallback, true /*keepLastValue*/);
    const searchResults = useMemo(() => {
        if (!searchResultState.value) {
            return [];
        }

        if (entityFilterType === SearchEntityFilterType.all) {
            return searchResultState.value;
        }

        return searchResultState.value.filter(result => matchesEntityFilter(entityFilterType, result.entityType));
    }, [searchResultState.value, entityFilterType]);

    useEffect(() => {
        searchResultState.run();
    }, [searchResultState.run]);

    return [searchResultState, searchResults] as const;
};

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const [entityFilterType, setEntityFilterType] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);

    const [searchResultState, searchResults] = useSearchResultsState(queryText, entityFilterType);

    return (
        <div className="search-page">
            <div className="search-info">
                <div>
                    <div className="page-title">Search Results for "{queryText}"</div>
                    <div className="search-result-count">
                        Search Results: {searchResultState.value?.length ?? 0}
                    </div>
                </div>
            </div>
            <div className="search-entity-selector">
                <EntityButton name="Menu Items and Stations"
                              isChecked={entityFilterType === SearchEntityFilterType.all}
                              onClick={() => setEntityFilterType(SearchEntityFilterType.all)}/>
                <EntityButton name="Menu Items Only"
                              isChecked={entityFilterType === SearchEntityFilterType.menuItem}
                              onClick={() => setEntityFilterType(SearchEntityFilterType.menuItem)}/>
                <EntityButton name="Stations Only"
                              isChecked={entityFilterType === SearchEntityFilterType.station}
                              onClick={() => setEntityFilterType(SearchEntityFilterType.station)}/>
            </div>
            {
                searchResultState.stage === PromiseStage.running && (
                    <>
                        <div className="loading-spinner"/>
                        <div>
                            Loading search results...
                        </div>
                    </>
                )
            }
            {
                searchResultState.stage === PromiseStage.error && (
                    <div className="error-card">
                        Error loading search results!
                        {/*TODO: Try again*/}
                    </div>
                )
            }
            {
                searchResultState.stage === PromiseStage.success && (
                    <SearchResultsList searchResults={searchResults} queryText={queryText} entityType={entityFilterType}/>
                )
            }
        </div>
    );
}