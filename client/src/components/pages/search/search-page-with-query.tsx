import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { SearchTypes } from '@msdining/common';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../../api/dining.ts';
import { IQuerySearchResult, SearchEntityFilterType } from '../../../models/search.ts';
import { classNames } from '../../../util/react.ts';
import { SearchResultsList } from '../../search/search-results-list.tsx';
import { EntityButton } from './entity-button.tsx';

import './search-page.css';

interface ISearchPageWithQueryProps {
    queryText: string;
}

interface ISearchResultsState {
    stage: PromiseStage;
    results: IQuerySearchResult[];
    tabCounts: Map<SearchTypes.SearchEntityType, number>;
}

const useSearchResultsState = (query: string, entityFilterType: SearchEntityFilterType): ISearchResultsState => {
    const doSearchCallback = useCallback(() => DiningClient.retrieveSearchResults(query), [query]);
    const searchResultState = useDelayedPromiseState(doSearchCallback, true /*keepLastValue*/);

    const allSearchResults = useMemo(
        () => searchResultState.value ?? [],
        [searchResultState.value, entityFilterType]
    );

    const resultCountByEntityType = useMemo(() => {
        const counts = new Map<SearchTypes.SearchEntityType, number>();

        for (const result of allSearchResults) {
            const count = counts.get(result.entityType) ?? 0;
            counts.set(result.entityType, count + 1);
        }

        return counts;
    }, [allSearchResults]);

    useEffect(() => {
        searchResultState.run();
    }, [searchResultState.run]);

    return {
        stage:     searchResultState.stage,
        results:   allSearchResults,
        tabCounts: resultCountByEntityType
    };
};

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const [entityFilterType, setEntityFilterType] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);
    const { stage, results, tabCounts } = useSearchResultsState(queryText, entityFilterType);

    const sharedEntityButtonProps = {
        currentFilter:    entityFilterType,
        totalResultCount: results.length,
        tabCounts,
    } as const;

    useEffect(() => {
        setEntityFilterType(SearchEntityFilterType.all);
    }, [queryText]);

    return (
        <div className="search-page">
            <div className="search-info">
                <div>
                    <div className="page-title">Search Results for "{queryText}"</div>
                    <div className="search-result-count">
                        Total Results: {results.length}
                    </div>
                </div>
                <div className={classNames('search-waiting', stage === PromiseStage.running && 'visible')}>
                    <div className="loading-spinner"/>
                    <div>
                        Loading search results...
                    </div>
                </div>
            </div>
            <div className="search-entity-selector">
                <EntityButton name="Menu Items and Stations"
                    type={SearchEntityFilterType.all}
                    onClick={() => setEntityFilterType(SearchEntityFilterType.all)}
                    {...sharedEntityButtonProps}
                />
                <EntityButton name="Menu Items Only"
                    type={SearchEntityFilterType.menuItem}
                    onClick={() => setEntityFilterType(SearchEntityFilterType.menuItem)}
                    {...sharedEntityButtonProps}
                />
                <EntityButton name="Stations Only"
                    type={SearchEntityFilterType.station}
                    onClick={() => setEntityFilterType(SearchEntityFilterType.station)}
                    {...sharedEntityButtonProps}
                />
            </div>
            {
                stage === PromiseStage.error && (
                    <div className="error-card">
                        Error loading search results!
                        {/*TODO: Try again*/}
                    </div>
                )
            }
            {
                stage === PromiseStage.success && (
                    <SearchResultsList searchResults={results} queryText={queryText} filter={entityFilterType}/>
                )
            }
        </div>
    );
};