import React from 'react';
import { IQuerySearchResult } from '../../../../models/search.ts';
import { HomeFavoriteResult } from '../favorites/home-favorite-result.js';
import { useSelectedDate } from '../../../../store/zustand/selected-date.ts';

interface IFavoritesSectionViewWithDataProps {
    results: IQuerySearchResult[];
}

export const FavoritesSectionViewWithData: React.FC<IFavoritesSectionViewWithDataProps> = ({ results }) => {
    const selectedDate = useSelectedDate();

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
