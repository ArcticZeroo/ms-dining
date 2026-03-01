import React, { useCallback, useEffect } from 'react';
import { useValueNotifierContext } from '../../../../hooks/events.js';
import { SelectedDateContext } from '../../../../context/time.js';
import { DiningClient } from '../../../../api/client/dining.js';
import { useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { SearchResultSkeleton } from '../../../search/search-result-skeleton.js';
import { SearchResultsList } from '../../../search/search-results-list.js';
import { SearchEntityFilterType, SearchResultsViewMode } from '../../../../models/search.js';
import { RetryButton } from '../../../button/retry-button.js';

const MAX_RESULT_COUNT = 10;

interface ISearchIdeasResults {
    searchQuery: string;
}

export const SearchIdeasResults: React.FC<ISearchIdeasResults> = ({ searchQuery }) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const retrieveSearchResultsCallback = useCallback(
        () => DiningClient.retrieveSearchResults({
            query:                searchQuery,
            date:                 selectedDate,
            isExplore:            true,
            onlyAvailableResults: true
        }),
        [searchQuery, selectedDate]
    );

    const {
        run: runRetrieveSearchResults,
        value,
        error
    } = useDelayedPromiseState(retrieveSearchResultsCallback, false /*keepLastValue*/);

    const isLoading = !value && !error;

    useEffect(() => {
        runRetrieveSearchResults();
    }, [runRetrieveSearchResults]);

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
                value && (
                    <SearchResultsList
                        searchResults={value}
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
                error && (
                    <div className="centered-content">
                        Could not load search results.
                        <RetryButton onClick={runRetrieveSearchResults}/>
                    </div>
                )
            }
        </>
    );
};