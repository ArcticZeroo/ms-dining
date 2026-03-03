import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import React from 'react';
import { IFavoritesSectionState } from '../../../../hooks/recommendations.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { FavoritesSectionViewWithData } from './favorites-section-view-with-data.tsx';
import { RecommendationSectionItemsSkeleton } from './recommendation-section-items-skeleton.js';

interface IFavoritesSectionViewProps {
    favorites: IFavoritesSectionState;
}

export const FavoritesSectionView: React.FC<IFavoritesSectionViewProps> = ({ favorites }) => {
    const { stage, results, retry } = favorites;

    if (stage === PromiseStage.error) {
        return (
            <div className="error-card">
                <span>
                    Could not load favorites.
                </span>
                <span className="centered-content">
                    <RetryButton onClick={retry} isDisabled={stage !== PromiseStage.error}/>
                </span>
            </div>
        );
    }

    if (results) {
        if (results.length === 0) {
            return (
                <div className="centered-content">
                    Nothing here today!
                </div>
            );
        }

        return <FavoritesSectionViewWithData results={results}/>;
    }

    return <RecommendationSectionItemsSkeleton/>;
};
