import React from 'react';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { IReviewSummary } from '@msdining/common/models/review';
import { HourglassLoadingSpinner } from '../icon/hourglass-loading-spinner.tsx';
import { RetryButton } from '../button/retry-button.tsx';
import { ReviewsViewWithData } from './reviews-view-with-data.tsx';
import { IReviewLookup, IReviewLookupForStation } from '../../models/reviews.js';

interface IReviewsViewProps {
    stage: PromiseStage;
    response: IReviewSummary | undefined;
    onRetry: () => void;
    cafeId: string;
    lookup: IReviewLookup;
    stationLookup?: IReviewLookupForStation;
}

export const ReviewsView: React.FC<IReviewsViewProps> = ({ stage, response, onRetry, cafeId, lookup, stationLookup }) => {
    if ([PromiseStage.notRun, PromiseStage.running].includes(stage)) {
        return (
            <div className="flex flex-center">
                <span>
                    Loading reviews...
                </span>
                <HourglassLoadingSpinner/>
            </div>
        );
    }

    if (stage === PromiseStage.error || response == null) {
        return (
            <div className="flex flex-center">
                <span>Could not load reviews!</span>
                <RetryButton onClick={onRetry}/>
            </div>
        );
    }

    return (
        <ReviewsViewWithData
            response={response}
            cafeId={cafeId}
            lookup={lookup}
            stationLookup={stationLookup}
        />
    );
};
