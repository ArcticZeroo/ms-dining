import { randomSortInPlace } from '../../../../util/random.ts';
import { useCallback, useEffect, useState } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { SearchResultsList } from '../../../search/search-results-list.tsx';
import { SearchEntityFilterType } from '../../../../models/search.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { classNames } from '../../../../util/react.ts';

import './search-ideas.css';

const SEARCH_IDEAS = randomSortInPlace([
    'latte',
    'gyro',
    'fried rice',
    'mango lassi',
    // 'milk tea', - not working right now for some reason
    'dessert',
    'drink',
    'vegetarian',
    'sushi',
]);

const MAX_RESULT_COUNT = 10;

export const SearchIdeas = () => {
    const [selectedIdea, setSelectedIdea] = useState(SEARCH_IDEAS[0]);

    const retrieveSearchResultsCallback = useCallback(() => DiningClient.retrieveSearchResults(selectedIdea, true /*isExact*/), [selectedIdea]);
    const {
        run: runRetrieveSearchResults,
        stage,
        value,
        error
    } = useDelayedPromiseState(retrieveSearchResultsCallback, false /*keepLastValue*/);

    useEffect(() => {
        runRetrieveSearchResults();
    }, [runRetrieveSearchResults]);

    return (
        <div className="flex-col">
            <div className="flex">
                {SEARCH_IDEAS.map(idea => (
                    <button
                        className={classNames('search-idea default-button default-container', idea === selectedIdea && 'selected')}
                        onClick={() => setSelectedIdea(idea)}
                    >
                        {idea}
                    </button>
                ))}
            </div>
            {
                stage === PromiseStage.running && (
                    <HourglassLoadingSpinner/>
                )
            }
            {
                value && (
                    <SearchResultsList
                        searchResults={value}
                        queryText={selectedIdea}
                        filter={SearchEntityFilterType.all}
                        isCompact={true}
                        limit={MAX_RESULT_COUNT}
                        showEndOfResults={false}
                        showSearchButtonInsteadOfLocations={true}
                    />
                )
            }
            {
                error && (
                    <div>
						Could not load search results.
                        <RetryButton onClick={runRetrieveSearchResults}/>
                    </div>
                )
            }
        </div>
    );
};