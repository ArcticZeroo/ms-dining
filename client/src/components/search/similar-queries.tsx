import React from 'react';
import { Link } from 'react-router-dom';
import { useRecommendedQueries } from '../../hooks/search.ts';
import { getSearchUrl } from '../../util/url.ts';
import { repeatComponent } from '../../util/react.ts';

const LOADING_SKELETON_COUNT = 5;

interface ISimilarQueriesProps {
    queryText: string;
}

export const SimilarQueries: React.FC<ISimilarQueriesProps> = ({ queryText }) => {
    const recommendedQueries = useRecommendedQueries(queryText);

    return (
        <div className="similar-queries flex flex-center flex-wrap">
            <span>
                Similar:
            </span>
            {
                !recommendedQueries.data && (
                    repeatComponent(
                        LOADING_SKELETON_COUNT,
                        () => (
                            <div className="recommended-query default-container default-button loading-skeleton">
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
                        className="recommended-query default-container default-button"
                        title={`Click to search for "${recommendedQuery}"`}
                    >
                        {recommendedQuery}
                    </Link>
                ))
            }
        </div>
    );
};
