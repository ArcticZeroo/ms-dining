import { SearchTypes } from '@msdining/common';
import React, { useEffect, useMemo, useState } from 'react';
import { useDateForSearch } from '../../../hooks/date-picker.tsx';
import { SearchEntityFilterType } from '../../../models/search.ts';
import { useSearchResultsQuery } from '../../../store/queries/search.ts';
import { SearchResultsList } from '../../search/search-results-list.tsx';
import { RetryButton } from '../../button/retry-button.tsx';
import { SearchWaiting } from '../../search/search-waiting.tsx';
import { SearchFilters } from '../../search/filters/search-filters.tsx';
import { classNames, repeatComponent } from '../../../util/react.ts';
import { useAllowedSearchViewIds, useRecommendedQueries } from '../../../hooks/search.ts';
import { Link } from 'react-router-dom';
import { getSearchUrl } from '../../../util/url.js';
import { EntityTypeSelector } from './entity-type-selector.js';

interface ISearchPageWithQueryProps {
    queryText: string;
}

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const allowedViewIds = useAllowedSearchViewIds();
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [entityFilterType, setEntityFilterType] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);
    const dateForSearch = useDateForSearch();

    const searchQuery = useSearchResultsQuery(queryText, dateForSearch);
    const results = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

    const tabCounts = useMemo(() => {
        const counts = new Map<SearchTypes.SearchEntityType, number>();
        for (const result of results) {
            const count = counts.get(result.entityType) ?? 0;
            counts.set(result.entityType, count + 1);
        }
        return counts;
    }, [results]);

    const recommendedQueries = useRecommendedQueries(queryText);

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
                            "{queryText}"
                        </span>
                        <SearchWaiting isPending={searchQuery.isFetching}/>
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
                        <EntityTypeSelector
                            selectedType={entityFilterType}
                            onSelectedTypeChanged={setEntityFilterType}
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
            {
                searchQuery.isError && (
                    <div className="error-card">
                        <p>
                            Error loading search results!
                        </p>
                        <p>
                            <RetryButton onClick={() => searchQuery.refetch()}/>
                        </p>
                    </div>
                )
            }
            <div className="similar-queries flex flex-center flex-wrap">
                <span>
                    Similar:
                </span>
                {
                    !recommendedQueries.data && (
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
                    recommendedQueries.data && recommendedQueries.data.map(recommendedQuery => (
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
                searchQuery.isSuccess && (
                    <SearchResultsList
                        searchResults={results}
                        queryText={queryText}
                        filter={entityFilterType}
                        allowedViewIds={allowedViewIds}
                    />
                )
            }
        </div>
    );
};