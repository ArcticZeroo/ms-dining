import React from 'react';
import { Link } from 'react-router-dom';
import { useRecommendedQueries } from '../../hooks/search.ts';
import { getSearchUrl } from '../../util/url.ts';
import { classNames, repeatComponent } from '../../util/react.ts';

import './similar-queries.css';

const LOADING_SKELETON_COUNT = 5;

interface ISimilarQueriesProps {
    queryText: string;
    /**
     * Compact mode: horizontal-scroll strip with reduced padding. Use in
     * narrow containers like the map side panel where the default wrapping
     * layout produces 3+ rows of pills.
     */
    compact?: boolean;
}

export const SimilarQueries: React.FC<ISimilarQueriesProps> = ({ queryText, compact = false }) => {
    const recommendedQueries = useRecommendedQueries(queryText);

    const containerClasses = classNames(
        'similar-queries flex flex-center flex-wrap',
        compact && 'compact shrink-padding'
    );
    const pillClasses = classNames(
        'recommended-query default-container default-button',
        compact && 'shrink-padding'
    );

    return (
        <div className={containerClasses}>
            {!compact && (
                <span>
                    Similar:
                </span>
            )}
            {
                !recommendedQueries.data && (
                    repeatComponent(
                        LOADING_SKELETON_COUNT,
                        () => (
                            <div className={`${pillClasses} loading-skeleton`}>
                                Loading...
                            </div>
                        )
                    )
                )
            }
            {
                recommendedQueries.data && recommendedQueries.data.map(recommendedQuery => (
                    <Link
                        key={recommendedQuery}
                        to={getSearchUrl(recommendedQuery)}
                        className={pillClasses}
                        title={`Click to search for "${recommendedQuery}"`}
                    >
                        {recommendedQuery}
                    </Link>
                ))
            }
        </div>
    );
};
