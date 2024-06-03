import { randomSortInPlace } from '../../../../util/random.ts';
import { useCallback, useEffect, useState } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { SearchResultsList } from '../../../search/search-results-list.tsx';
import {SearchEntityFilterType, SearchResultsViewMode} from '../../../../models/search.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { classNames } from '../../../../util/react.ts';

import './search-ideas.css';
import { SearchResultSkeleton } from '../../../search/search-result-skeleton.tsx';

const SEARCH_IDEAS = randomSortInPlace([
    'burger',
    'burrito',
    'dessert',
    'fried rice',
    'gyro',
    'latte',
    // 'mango lassi', - only one result
    // 'milk tea', - not working right now for some reason
    'pasta',
    'sushi',
    'vegetarian',
]);

const MAX_RESULT_COUNT = 10;

export const SearchIdeas = () => {
    const [selectedIdea, setSelectedIdea] = useState(SEARCH_IDEAS[0]);

    const retrieveSearchResultsCallback = useCallback(() => DiningClient.retrieveSearchResults(selectedIdea), [selectedIdea]);
    const {
        run: runRetrieveSearchResults,
        value,
        error
    } = useDelayedPromiseState(retrieveSearchResultsCallback, false /*keepLastValue*/);

    useEffect(() => {
        runRetrieveSearchResults();
    }, [runRetrieveSearchResults]);

    return (
        <div className="flex-col">
            <div className="flex search-ideas">
                {SEARCH_IDEAS.map(idea => (
                    <button
                        className={classNames('search-idea default-container', idea === selectedIdea && 'selected')}
                        onClick={() => setSelectedIdea(idea)}
                    >
                        {idea}
                    </button>
                ))}
            </div>
            {
                !value && (
                    <div>
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
                        queryText={selectedIdea}
                        filter={SearchEntityFilterType.all}
                        viewMode={SearchResultsViewMode.horizontalScroll}
                        isCompact={true}
                        limit={MAX_RESULT_COUNT}
                        showEndOfResults={false}
                        showSearchButtonInsteadOfLocations={true}
                        shouldStretchResults={true}
                        shouldPromptUserForLocation={false}
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
        </div>
    );
};