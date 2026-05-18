import React from 'react';
import { useSelectedDate } from '../../../../store/zustand/selected-date.ts';
import { useExploreSearchResultsQuery } from '../../../../store/queries/search.js';
import { SearchResultSkeleton } from '../../../search/search-result-skeleton.js';
import { SearchResultsList } from '../../../search/search-results-list.js';
import { SearchEntityFilterType, SearchResultsViewMode } from '../../../../models/search.js';
import { RetryButton } from '../../../button/retry-button.js';

const MAX_RESULT_COUNT = 10;

interface ISearchIdeasResults {
    searchQuery: string;
}

export const SearchIdeasResults: React.FC<ISearchIdeasResults> = ({ searchQuery }) => {
    const selectedDate = useSelectedDate();

    const { data, isError, refetch } = useExploreSearchResultsQuery(searchQuery, selectedDate);
    const isLoading = !data && !isError;

    return (
        <>
            {
                isLoading && (
                    <div className="flex">
                        <SearchResultSkeleton
                            isCompact={true}
                            shouldStretchResults={true}
                            showSearchButtonInsteadOfLocations={true}
                            showFavoriteButton={true}
                        />
                    </div>
                )
            }
            {
                data && (
                    <SearchResultsList
                        searchResults={data}
                        queryText={searchQuery}
                        filter={SearchEntityFilterType.all}
                        viewMode={SearchResultsViewMode.horizontalScroll}
                        isCompact={true}
                        limit={MAX_RESULT_COUNT}
                        showEndOfResults={false}
                        showOnlyCafeNames={true}
                        shouldStretchResults={true}
                        shouldPromptUserForLocation={false}
                        showSearchButtonInsteadOfLocations={true}
                        noResultsView={'Nothing here right now!'}
                    />
                )
            }
            {
                isError && (
                    <div className="centered-content">
                        Could not load search results.
                        <RetryButton onClick={() => refetch()}/>
                    </div>
                )
            }
        </>
    );
};