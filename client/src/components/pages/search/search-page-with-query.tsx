import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { SearchTypes } from '@msdining/common';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../../api/dining.ts';
import { useDateForSearch } from '../../../hooks/date-picker.tsx';
import { IQuerySearchResult, SearchEntityFilterType } from '../../../models/search.ts';
import { SearchResultsList } from '../../search/search-results-list.tsx';
import { EntityButton } from './entity-button.tsx';
import { MenusCurrentlyUpdatingException } from '../../../util/exception.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import './search-page.css';
import { SearchWaiting } from '../../search/search-waiting.tsx';
import { SearchFilters } from '../../search/filters/search-filters.tsx';
import { classNames, repeatComponent } from '../../../util/react.ts';
import { useAllowedSearchViewIds, useRecommendedQueries } from '../../../hooks/search.ts';
import { Link } from 'react-router-dom';
import { getSearchUrl } from '../../../util/url.js';

interface ISearchPageWithQueryProps {
    queryText: string;
}

interface ISearchResultsState {
    actualStage: PromiseStage;
    stage: PromiseStage;
    results: IQuerySearchResult[];
    tabCounts: Map<SearchTypes.SearchEntityType, number>;
    queryForCurrentResults: string;
    areMenusCurrentlyUpdating: boolean;
    retrieveSearchResults: () => void;
}

const useSearchResultsState = (query: string): ISearchResultsState => {
    const [queryForCurrentResults, setQueryForCurrentResults] = useState(query);
    const dateForSearch = useDateForSearch();

    const doSearchCallback = useCallback(
        () => DiningClient.retrieveSearchResults({
            query,
            date: dateForSearch
        }).finally(() => setQueryForCurrentResults(query)),
        [query, dateForSearch]
    );

    const {
        actualStage: actualSearchResultStage,
        stage:       searchResultStage,
        value:       searchResults,
        error:       searchResultsError,
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
        actualStage:               actualSearchResultStage,
        stage:                     searchResultStage,
        results:                   allSearchResults,
        tabCounts:                 resultCountByEntityType,
        queryForCurrentResults:    queryForCurrentResults,
        areMenusCurrentlyUpdating: searchResultsError != null && searchResultsError instanceof MenusCurrentlyUpdatingException,
        retrieveSearchResults
    };
};

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const allowedViewIds = useAllowedSearchViewIds();
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [entityFilterType, setEntityFilterType] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);

    const {
        actualStage,
        stage,
        results,
        tabCounts,
        queryForCurrentResults,
        areMenusCurrentlyUpdating,
        retrieveSearchResults
    } = useSearchResultsState(queryText);

    const recommendedQueriesState = useRecommendedQueries(queryText);

    const sharedEntityButtonProps = {
        currentFilter:    entityFilterType,
        totalResultCount: results.length,
        tabCounts,
    } as const;

    useEffect(() => {
        setEntityFilterType(SearchEntityFilterType.all);
    }, [queryText]);

    return (
        <div className="search-page flex-col">
            <div className="search-page-header">
                <div className="search-info flex flex-col default-container">
                    <div className="query flex flex-between default-container">
                        <span className="icon-sized"/>
                        <span>
                            "{queryForCurrentResults}"
                        </span>
                        <SearchWaiting stage={actualStage}/>
                    </div>
                    <div className="flex">
                        <button
                            className={classNames('search-filters-button default-container flex transition-background', isFilterMenuOpen && 'open')}
                            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}>
                            <span className="material-symbols-outlined icon">
                                filter_list
                            </span>
                            <span>
                                Filters
                            </span>
                        </button>
                        <div className="search-entity-selector">
                            <EntityButton name="Menu Items, Stations, and Cafes"
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
                            <EntityButton name="Cafes Only"
                                type={SearchEntityFilterType.cafe}
                                onClick={() => setEntityFilterType(SearchEntityFilterType.cafe)}
                                {...sharedEntityButtonProps}
                            />
                        </div>
                    </div>
                    {
                        isFilterMenuOpen && (
                            <SearchFilters/>
                        )
                    }
                </div>
            </div>
            {
                stage === PromiseStage.error && (
                    <div className="error-card">
                        <p>
                            Error loading search results!
                        </p>
                        {
                            areMenusCurrentlyUpdating && (
                                <p>
                                    Menus are currently updating. Please try again soon!
                                </p>
                            )
                        }
                        {
                            // If we hit retry, actualStage will change but stage will stay error
                            actualStage === PromiseStage.error && (
                                <p>
                                    <RetryButton onClick={retrieveSearchResults}/>
                                </p>
                            )
                        }
                    </div>
                )
            }
            <div className="similar-queries flex flex-center flex-wrap">
                <span>
                    Similar:
                </span>
                {
                    !recommendedQueriesState.value && (
                        <>
                            {
                                repeatComponent(
                                    5,
                                    () => (
                                        <div className="recommended-query default-container default-button loading-skeleton">
                                            Loading...
                                        </div>
                                    )
                                )
                            }
                        </>
                    )
                }
                {
                    recommendedQueriesState.value && recommendedQueriesState.value.map(recommendedQuery => (
                        <Link
                            key={recommendedQuery}
                            to={getSearchUrl(recommendedQuery)}
                            className="recommended-query default-container default-button"
                            title={`Click to search for "${recommendedQuery}"`}
                        >
                            {recommendedQuery}
                        </Link>
                    ))
                }
            </div>
            {
                stage === PromiseStage.success && (
                    <SearchResultsList
                        searchResults={results}
                        queryText={queryForCurrentResults}
                        filter={entityFilterType}
                        allowedViewIds={allowedViewIds}
                    />
                )
            }
        </div>
    );
};