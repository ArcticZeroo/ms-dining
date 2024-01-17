import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { SearchTypes } from '@msdining/common';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../../api/dining.ts';
import { IQuerySearchResult, SearchEntityFilterType } from '../../../models/search.ts';
import { SearchResultsList } from '../../search/search-results-list.tsx';
import { SearchWaiting } from '../../search/search-waiting.tsx';
import { PriceFiltersSetting } from '../../settings/price-filters-setting.tsx';
import { EntityButton } from './entity-button.tsx';

import './search-page.css';

interface ISearchPageWithQueryProps {
    queryText: string;
}

interface ISearchResultsState {
    actualStage: PromiseStage;
    stage: PromiseStage;
    results: IQuerySearchResult[];
    tabCounts: Map<SearchTypes.SearchEntityType, number>;
    lastQuery: string;
}

const useSearchResultsState = (query: string): ISearchResultsState => {
    const [lastQueryText, setLastQueryText] = useState(query);
    const doSearchCallback = useCallback(
        () => DiningClient.retrieveSearchResults(query).finally(() => setLastQueryText(query)),
        [query]
    );

    const {
        actualStage: actualSearchResultStage,
        stage:       searchResultStage,
        value:       searchResults,
        run:         retrieveSearchResults
    } = useDelayedPromiseState(doSearchCallback, true /*keepLastValue*/);

    const allSearchResults = useMemo(
        () => searchResults ?? [],
        [searchResults]
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
        retrieveSearchResults();
    }, [retrieveSearchResults]);

    return {
        actualStage: actualSearchResultStage,
        stage:       searchResultStage,
        results:     allSearchResults,
        tabCounts:   resultCountByEntityType,
        lastQuery:       lastQueryText
    };
};

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const [entityFilterType, setEntityFilterType] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);
    const { actualStage, stage, results, tabCounts, lastQuery } = useSearchResultsState(queryText);

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
            <div className="search-page-header">
                <div className="search-info">
                    <div className="page-title">Search Results for "{lastQuery}"</div>
                    <div className="search-result-count">
                        Total Results: {results.length}
                    </div>
                    <div className="search-filter-selector">
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
                </div>
                {/* use actualStage here to show the loading icon when doing a new search after one already exists */}
                <SearchWaiting stage={actualStage}/>
            </div>
            <PriceFiltersSetting isOwnCard={true}/>
            {/* use stage here to show the last completed search results */}
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