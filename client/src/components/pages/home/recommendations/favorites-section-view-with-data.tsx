import React from 'react';
import { IQuerySearchResult } from '../../../../models/search.ts';
import { HomeFavoriteResult } from '../favorites/home-favorite-result.js';
import { SelectedDateContext } from '../../../../context/time.js';
import { useValueNotifierContext } from '../../../../hooks/events.js';

interface IFavoritesSectionViewWithDataProps {
    results: IQuerySearchResult[];
}

export const FavoritesSectionViewWithData: React.FC<IFavoritesSectionViewWithDataProps> = ({ results }) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    return (
        <div className="recommendation-section-items flex horizontal-scroll">
            {results.map(result => (
                <HomeFavoriteResult
                    key={result.name}
                    result={result}
                    date={selectedDate}
                />
            ))}
        </div>
    );
};
