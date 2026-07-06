import React from 'react';
import { SimilarQueries } from '../../search/similar-queries.tsx';
import { useSearchPageWithQuery } from '../../../hooks/search-page-with-query.ts';
import { SearchPageError } from './search-page-error.tsx';
import { SearchPageHeader } from './search-page-header.tsx';
import { SearchPageResults } from './search-page-results.tsx';

interface ISearchPageWithQueryProps {
    queryText: string;
}

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const {
        entityFilterType,
        isError,
        isFetching,
        isFilterMenuOpen,
        isSuccess,
        results,
        retrySearch,
        setEntityFilterType,
        tabCounts,
        toggleFilterMenu,
    } = useSearchPageWithQuery(queryText);

    return (
        <div className="search-page flex-col">
            <SearchPageHeader
                entityFilterType={entityFilterType}
                isFetching={isFetching}
                isFilterMenuOpen={isFilterMenuOpen}
                onFilterMenuToggled={toggleFilterMenu}
                onSelectedTypeChanged={setEntityFilterType}
                queryText={queryText}
                tabCounts={tabCounts}
            />
            <SearchPageError isError={isError} onRetry={retrySearch}/>
            <SimilarQueries queryText={queryText}/>
            <SearchPageResults
                filter={entityFilterType}
                isSuccess={isSuccess}
                queryText={queryText}
                searchResults={results}
            />
        </div>
    );
};